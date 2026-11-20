import type { TeacherPermission } from '@svr/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Visible when the user has ANY of these (admins see everything). */
  perms: (TeacherPermission | 'admin')[];
}

export const NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: '◧', perms: ['admin', 'students.view', 'exams.manage', 'live.manage', 'content.upload'] }] },
  {
    section: 'People',
    items: [
      { to: '/students', label: 'Students', icon: '◉', perms: ['admin', 'students.view'] },
      { to: '/teachers', label: 'Teachers', icon: '◎', perms: ['admin'] },
      { to: '/parents', label: 'Parents', icon: '◌', perms: ['admin'] },
      { to: '/admissions', label: 'Admissions', icon: '✦', perms: ['admin'] },
    ],
  },
  {
    section: 'Academics',
    items: [
      { to: '/courses', label: 'Courses & Content', icon: '▤', perms: ['courses.manage', 'content.upload'] },
      { to: '/live', label: 'Live Classes', icon: '●', perms: ['live.manage'] },
      { to: '/attendance', label: 'Attendance', icon: '✓', perms: ['attendance.manage'] },
      { to: '/exams', label: 'Examinations', icon: '✎', perms: ['exams.manage', 'exams.evaluate'] },
      { to: '/question-bank', label: 'Question Bank', icon: '∑', perms: ['exams.manage'] },
      { to: '/homework', label: 'Homework', icon: '❏', perms: ['homework.manage'] },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/fees', label: 'Fees & Invoices', icon: '₹', perms: ['admin'] },
      { to: '/payments', label: 'Payments', icon: '⇄', perms: ['admin'] },
    ],
  },
  {
    section: 'Engagement',
    items: [
      { to: '/announcements', label: 'Notifications', icon: '✉', perms: ['announcements.send'] },
      { to: '/website', label: 'Website Content', icon: '⌂', perms: ['admin'] },
    ],
  },
  {
    section: 'System',
    items: [
      { to: '/reports', label: 'Reports', icon: '▥', perms: ['admin'] },
      { to: '/settings', label: 'Settings', icon: '⚙', perms: ['admin'] },
    ],
  },
];
