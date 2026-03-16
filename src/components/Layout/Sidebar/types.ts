import { LucideIcon } from 'lucide-react';

export type Role = 'entrepreneur' | 'deliverer' | 'admin';

export type SidebarLink = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  badgeKey?: 'activeDeliveries' | 'notifications' | 'pendingPayments';
};

export type SidebarSection = {
  id: string;
  title: string;
  links: SidebarLink[];
};
