import { NavLink } from 'react-router-dom';
import { SidebarLink } from './types';

type Props = {
  link: SidebarLink;
  collapsed: boolean;
  badge?: number;
  accent: 'blue' | 'green' | 'purple';
};

export default function SidebarItem({ link, collapsed, badge, accent }: Props) {
  return (
    <NavLink
      to={link.to}
      className={({ isActive }) =>
        `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? accent === 'blue'
              ? 'bg-blue-50 text-blue-700'
              : accent === 'green'
              ? 'bg-green-50 text-green-700'
              : 'bg-purple-50 text-purple-700'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      <div className="flex items-center space-x-3">
        <link.icon size={20} />
        {!collapsed && <span>{link.label}</span>}
      </div>

      {!collapsed && badge && badge > 0 && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
