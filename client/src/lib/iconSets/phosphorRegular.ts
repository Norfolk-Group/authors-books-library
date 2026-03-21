/**
 * Phosphor Regular Icon Set
 *
 * Closest open-source match to Manus icon style.
 * weight="regular" = 1.5px stroke, rounded caps - matches Manus exactly.
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

import type { IconCatalogue } from "@/contexts/IconContext";

export const phosphorRegularSet: IconCatalogue = {
  // Navigation
  newTask: NotePencilIcon,
  search: MagnifyingGlassIcon,
  library: BooksIcon,
  projects: FolderIcon,
  settings: GearIcon,
  notifications: BellIcon,
  agents: RobotIcon,
  // Actions
  add: PlusIcon,
  edit: PencilSimpleIcon,
  close: XIcon,
  back: ArrowLeftIcon,
  download: DownloadSimpleIcon,
  upload: UploadSimpleIcon,
  share: ShareNetworkIcon,
  attach: PaperclipIcon,
  send: PaperPlaneTiltIcon,
  more: DotsThreeIcon,
  // Content types
  authors: UsersIcon,
  books: BookOpenIcon,
  audiobooks: HeadphonesIcon,
  categories: SquaresFourIcon,
  pdf: FilePdfIcon,
  transcript: AlignLeftIcon,
  binder: ArchiveBoxIcon,
  supplemental: PackageIcon,
  video: VideoIcon,
  image: ImageIcon,
  externalLink: ArrowSquareOutIcon,
  // Utility
  sort: ArrowsDownUpIcon,
  filter: FunnelIcon,
  bio: IdentificationCardIcon,
  // Status
  statusIdle: CircleIcon,
  statusDone: CheckCircleIcon,
  statusFailed: XCircleIcon,
  statusPaused: PauseCircleIcon,
};
