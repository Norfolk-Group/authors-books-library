/**
 * Phosphor Duotone Icon Set
 *
 * Two-tone fill style - richer on dark themes (Noir Dark, dark mode).
 * Same component names as regular set; weight prop changes the visual style.
 *
 * Install: pnpm add @phosphor-icons/react
 */

import {
  NotePencilIcon,
  MagnifyingGlassIcon,
  BooksIcon,
  FolderIcon,
  GearIcon,
  BellIcon,
  RobotIcon,
  PlusIcon,
  PencilSimpleIcon,
  XIcon,
  ArrowLeftIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
  ShareNetworkIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  DotsThreeIcon,
  UsersIcon,
  BookOpenIcon,
  HeadphonesIcon,
  SquaresFourIcon,
  FilePdfIcon,
  AlignLeftIcon,
  ArchiveBoxIcon,
  PackageIcon,
  VideoIcon,
  ImageIcon,
  ArrowSquareOutIcon,
  ArrowsDownUpIcon,
  FunnelIcon,
  IdentificationCardIcon,
  CircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PauseCircleIcon,
} from "@phosphor-icons/react";

import React from "react";
import type { IconCatalogue, IconComponent } from "@/contexts/IconContext";

// Wrap each icon to force duotone weight
function duotone(Icon: IconComponent): IconComponent {
  return (props) => <Icon {...props} weight="duotone" />;
}

export const phosphorDuotoneSet: IconCatalogue = {
  // Navigation
  newTask: duotone(NotePencilIcon),
  search: duotone(MagnifyingGlassIcon),
  library: duotone(BooksIcon),
  projects: duotone(FolderIcon),
  settings: duotone(GearIcon),
  notifications: duotone(BellIcon),
  agents: duotone(RobotIcon),
  // Actions
  add: duotone(PlusIcon),
  edit: duotone(PencilSimpleIcon),
  close: duotone(XIcon),
  back: duotone(ArrowLeftIcon),
  download: duotone(DownloadSimpleIcon),
  upload: duotone(UploadSimpleIcon),
  share: duotone(ShareNetworkIcon),
  attach: duotone(PaperclipIcon),
  send: duotone(PaperPlaneTiltIcon),
  more: duotone(DotsThreeIcon),
  // Content types
  authors: duotone(UsersIcon),
  books: duotone(BookOpenIcon),
  audiobooks: duotone(HeadphonesIcon),
  categories: duotone(SquaresFourIcon),
  pdf: duotone(FilePdfIcon),
  transcript: duotone(AlignLeftIcon),
  binder: duotone(ArchiveBoxIcon),
  supplemental: duotone(PackageIcon),
  video: duotone(VideoIcon),
  image: duotone(ImageIcon),
  externalLink: duotone(ArrowSquareOutIcon),
  // Utility
  sort: duotone(ArrowsDownUpIcon),
  filter: duotone(FunnelIcon),
  bio: duotone(IdentificationCardIcon),
  // Status (always fill for status icons)
  statusIdle: duotone(CircleIcon),
  statusDone: duotone(CheckCircleIcon),
  statusFailed: duotone(XCircleIcon),
  statusPaused: duotone(PauseCircleIcon),
};
