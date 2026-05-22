---
title: How I Installed Arch Linux on My Lenovo Legion Slim 5 — A Returning User's Journey
description: After six years away from Linux, I moved back to Arch on a Lenovo Legion Slim 5 (AMD Ryzen + RTX 4060). Frustrated by Windows 11 bloat and telemetry, I decided to dual boot Arch Linux and document the whole installation and setup process.
pubDate: 2026-05-23
tags:
  - tutorial
  - linux
  - arch-linux
categories:
  - Guide
translationKey: how-i-installed-arch-linux-on-my-laptop
pinned: false
toc: true
unlisted: false
unlistedHideFromSeo: true
---
> **Note:** This is not a tutorial on how to install Arch Linux. This is written for my future references and education purposes only. It's best that you follow the [official Arch Linux Wiki](https://wiki.archlinux.org/title/Installation_guide) to install Arch on your machine. I won't take any responsibilities if you follow and messes up in the process.

## Why Arch, and Why Now?

The "Year of the Linux Desktop" joke has been running for decades, but 2026 genuinely feels different. Gaming on Linux has transformed thanks to Valve's Proton and Steam Deck. Wayland is finally mature enough for daily use. And hardware support — even for NVIDIA — has improved dramatically.

I chose Arch because I already knew it, and because its philosophy aligns with how I like to work: you build exactly what you need, nothing more. The Arch Wiki remains one of the best technical documentation resources on the internet, and the rolling release model means I'm always on the latest packages.

---

## Pre-Installation: Getting Windows Ready

Before touching a live ISO, there are a few things to handle on the Windows side.

### Disabling Fast Startup and Hibernation

Fast Startup causes Windows to write a hibernation snapshot to the NTFS partition on shutdown. If Linux mounts that partition while the snapshot is active, filesystem corruption can occur. I had previously debloated Windows using the [Chris Titus Tech script](https://christitus.com/win/), which conveniently disables both features.

### Shrinking the Windows Partition

I needed to carve out space for Arch from the existing Windows partition. Disk Management couldn't shrink far enough due to unmovable system files — a common issue. I used **MiniTool Partition Wizard** instead, which handled it cleanly without needing to boot from a live environment.

I ended up allocating **250GB for Arch** out of a 1TB NVMe SSD, leaving Windows plenty of room.

### Expanding the ESP

My EFI System Partition was nearly full, which would have caused problems with rEFInd. I used GParted from a live USB to expand it before proceeding. Not something you normally need to do, but worth knowing if you hit the same wall.

### Backing Up Windows

I used **Macrium Reflect** to create a full image backup of the C: drive before touching anything. Macrium compressed 300GB of used space down to about 120GB — fast and efficient. I copied the backup to an external drive for safekeeping.

---

## Installation: The Manual Way

I chose to install Arch manually rather than using `archinstall`. The script has improved over the years, but for a dual-boot setup with btrfs subvolumes, doing it by hand gives more control and fewer surprises.

### Why btrfs?

Traditional ext4 partitioning requires you to decide upfront how much space to allocate to `/` and `/home` separately. Get it wrong and you end up with one partition full while the other sits idle. btrfs solves this elegantly: subvolumes share a single storage pool, so space is allocated dynamically.

The other major benefit is native snapshot support. Timeshift's btrfs backend creates near-instant snapshots with minimal overhead — a lifesaver when something breaks after an update.

### Partition Layout

I kept the existing ESP from Windows and created one new btrfs partition in the unallocated space:

```
/dev/nvme0n1p1  →  /boot       (ESP, shared with Windows, FAT32)
/dev/nvme0n1p2  →  (Windows partitions)
/dev/nvme0n1p5  →  /           (btrfs, 250GB)
```

### btrfs Subvolume Setup

```bash
mount /dev/nvme0n1p5 /mnt
btrfs subvolume create /mnt/@
btrfs subvolume create /mnt/@home
btrfs subvolume create /mnt/@snapshots
btrfs subvolume create /mnt/@var_log
umount /mnt

mount -o noatime,compress=zstd,subvol=@ /dev/nvme0n1p5 /mnt
mkdir -p /mnt/{boot,home,.snapshots,var/log}
mount -o noatime,compress=zstd,subvol=@home /dev/nvme0n1p5 /mnt/home
mount -o noatime,compress=zstd,subvol=@snapshots /dev/nvme0n1p5 /mnt/.snapshots
mount -o noatime,compress=zstd,subvol=@var_log /dev/nvme0n1p5 /mnt/var/log
mount /dev/nvme0n1p1 /mnt/boot
```

`noatime` and `compress=zstd` are mount options worth keeping: `noatime` reduces unnecessary disk writes, and `zstd` compression is transparent and can actually improve performance on SSDs by reducing I/O.

### Base Installation

```bash
pacstrap /mnt base base-devel linux linux-firmware linux-headers \
  btrfs-progs networkmanager grub efibootmgr os-prober vim sudo
```

The usual post-pacstrap config: `genfstab`, `arch-chroot`, timezone, locale, hostname, root password, user creation.

---

## Bootloader: rEFInd Instead of GRUB

I initially planned to use GRUB for dual boot, but switched to **rEFInd** during installation. rEFInd auto-detects all bootable entries on the ESP — Windows Boot Manager and the Linux kernel are both picked up automatically without any manual config. No need to run `grub-mkconfig` after every kernel update.

My kernel parameters in `refind_linux.conf`:

```
root=PARTUUID=<uuid> rw add_efi_memmap initrd=amd-ucode.img
initrd=initramfs-linux.img rootflags=subvol=@ 
nvidia-drm.modeset=1 nvidia_drm.fbdev=1 loglevel=3 quiet splash
```

A few things worth noting: `amd-ucode.img` loads CPU microcode updates for the AMD Ryzen — important for security and stability. `nvidia-drm.modeset=1` is required for Wayland with NVIDIA. And `rootflags=subvol=@` tells the kernel to mount the `@` subvolume as root.

---

## Post-Installation: NVIDIA First, Desktop Second

This is the order that matters most. Install the NVIDIA driver **before** installing the desktop environment. Skipping this leads to a black screen after the first reboot into KDE.

### NVIDIA Driver Setup

```bash
sudo pacman -S nvidia-dkms nvidia-utils lib32-nvidia-utils nvidia-settings
```

`lib32-nvidia-utils` requires multilib to be enabled in `/etc/pacman.conf` — uncomment the `[multilib]` section before running this.

Then add NVIDIA modules to the initramfs:

```bash
# /etc/mkinitcpio.conf
MODULES=(nvidia nvidia_modeset nvidia_uvm nvidia_drm)
```

```bash
sudo mkinitcpio -P
```

This ensures NVIDIA is loaded at boot before any display server starts, preventing the Nouveau driver from interfering.

### KDE Plasma + SDDM

```bash
sudo pacman -S plasma-meta sddm
sudo systemctl enable sddm
```

I started with `plasma-meta` to keep things lean, then added individual KDE apps as needed (Dolphin, Konsole, Kate, Ark, Gwenview, Okular, Spectacle) rather than installing the full `kde-applications-meta` bundle.

### Fixing SDDM on NVIDIA + Wayland

After the first reboot, SDDM failed with "Failed to read display number from pipe" — a classic NVIDIA + X11 conflict. The fix is to force SDDM to use Wayland:

```bash
sudo mkdir -p /etc/sddm.conf.d
sudo tee /etc/sddm.conf.d/wayland.conf << 'EOF'
[General]
DisplayServer=wayland
GreeterEnvironment=QT_WAYLAND_SHELL_INTEGRATION=layer-shell

[Wayland]
CompositorCommand=kwin_wayland --drm --no-lockscreen --no-global-shortcuts
EOF
```

---

## Legion-Specific Setup

The Legion Slim 5 has hardware that needs dedicated tooling to manage properly on Linux.

### GPU Mode Switching with envycontrol

The laptop has two GPUs: an AMD Radeon iGPU and the RTX 4060 dGPU. `envycontrol` manages switching between them cleanly:

```bash
paru -S envycontrol
sudo envycontrol -s nvidia    # dedicated mode, always-on dGPU
```

Other available modes: `integrated` (iGPU only, best battery life) and `hybrid` (dGPU on-demand via PRIME). Switching modes requires a reboot.

Note: the two USB-C ports on this laptop are wired to different GPUs. The port connected to the dGPU won't output video in `integrated` mode since the dGPU is powered off entirely.

### Performance Modes and Fan Control

`lenovolegionlinux` provides kernel modules and userspace tools that replicate most of Legion Vantage's functionality:

```bash
paru -S lenovolegionlinux-git
```

This gives access to `legion_cli` and `legion_gui` for switching between Silent, Balanced, and Performance modes, adjusting fan curves, and reading sensor data. Combined with the **PlasmaVantage** KDE widget, it integrates neatly into the desktop.

### Battery Conservation Mode

To protect long-term battery health, I set up conservation mode (limits charging to ~80%) as a persistent systemd service:

```bash
sudo tee /etc/systemd/system/battery-conservation.service << 'EOF'
[Unit]
Description=Enable Battery Conservation Mode
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c "echo 1 > /sys/bus/platform/drivers/ideapad_acpi/*/conservation_mode"

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable battery-conservation.service
```

### Power Management

```bash
paru -S auto-cpufreq
sudo auto-cpufreq --install
```

`auto-cpufreq` handles CPU governor switching automatically based on system load and power source. Combined with zram for memory compression, the system stays responsive without unnecessary battery drain.

---

## Quality of Life Setup

### zram

With 16GB of RAM, a swap partition on SSD is unnecessary and causes needless write wear. zram compresses data in RAM instead:

```bash
sudo pacman -S zram-generator
sudo tee /etc/systemd/zram-generator.conf << 'EOF'
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
EOF
```

### Vietnamese Input Method: fcitx5 + Lotus

For Vietnamese input on Wayland, I used **fcitx5** with the [Lotus input method](https://lotusinputmethod.github.io/) — a community-maintained fork focused on non-preedit typing, which eliminates the underline artifacts that plague most Vietnamese IMEs on Wayland.

```bash
sudo pacman -S fcitx5 fcitx5-qt fcitx5-gtk fcitx5-configtool
yay -S fcitx5-lotus-bin
```

On KDE Wayland, fcitx5 must be launched by KWin, not via autostart. Set this in **System Settings → Input & Output → Keyboard → Virtual Keyboard → Fcitx 5**.

### Shell: zsh + Starship

```bash
sudo pacman -S zsh starship zsh-autosuggestions zsh-syntax-highlighting
chsh -s $(which zsh)
```

`~/.zshrc`:

```bash
source /usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
source /usr/share/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
eval "$(starship init zsh)"
```

### Mounting the Windows Data Drive

I mounted the Windows D: partition directly into my home directory for easy access:

```
UUID=<ntfs-partition-uuid>  /home/datadrive  ntfs3  defaults,nofail,uid=1000,gid=1000  0  0
```

`ntfs3` is the modern in-kernel NTFS driver, faster than the older `ntfs-3g`. The `nofail` flag ensures the system boots normally even if the partition is inaccessible (e.g., if Windows left it in a hibernated state).

### Snapshots: Timeshift

The first thing I did after finishing setup was create a Timeshift snapshot. I learned this lesson the hard way years ago when a broken bootloader forced me to reinstall everything from scratch.

With the btrfs backend, snapshots are nearly instant and take up almost no space. I run: daily (keep 3), weekly (keep 2), monthly (keep 1).

---

## Gaming: Steam + Proton

```bash
sudo pacman -S steam
```

In Steam settings, enable **Steam Play for all titles** and select Proton Experimental. I also installed Proton-GE for better compatibility with certain titles:

```bash
paru -S proton-ge-custom-bin
```

Before installing any game, I check [ProtonDB](https://www.protondb.com/) for community reports. Most games with a Gold or Platinum rating just work out of the box.

---

## Reflections

Coming back to Linux after six years, the biggest surprise was how much less friction there is now. The things that used to take hours of troubleshooting — hybrid graphics, Wayland stability, gaming — either just work or require a handful of straightforward steps.

The NVIDIA situation is still the most complex part of any Linux setup, but it's manageable. The key insight is to get the driver properly configured before the desktop environment ever loads.

For anyone on the fence about switching: if your workflow doesn't depend on Adobe Creative Suite or specific anti-cheat titles like Valorant, there's genuinely no reason to stay on Windows. And even with those constraints, dual booting is a perfectly workable middle ground.

The irony isn't lost on me that I spent years away from Linux, came back, and spent one evening getting everything working. It's not perfect, but it's mine — and that's the point.

Thanks for reading!

---

_**My setup**: Lenovo Legion Slim 5 R7000P · AMD Ryzen 7 8845H · RTX 4060 8GB Laptop · Arch Linux · KDE Plasma 6 · Wayland · rEFInd · btrfs_