import { dom } from './state.js';

export function toggleSidebar() {
  dom.sidebar.classList.toggle('collapsed');
  const isCollapsed = dom.sidebar.classList.contains('collapsed');

  dom.rightSidebarExpand.classList.toggle('visible', isCollapsed);

  const icon = dom.sidebarToggle.querySelector('svg');
  if (!icon) return;
  if (isCollapsed) {
    icon.innerHTML = '<polyline points="15 18 9 12 15 6"></polyline>';
    dom.sidebarToggle.title = 'Expand sidebar';
  } else {
    icon.innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>';
    dom.sidebarToggle.title = 'Collapse sidebar';
  }
}

export function toggleLeftSidebar() {
  dom.leftSidebar.classList.toggle('collapsed');
  const isCollapsed = dom.leftSidebar.classList.contains('collapsed');

  dom.leftSidebarExpand.classList.toggle('visible', isCollapsed);

  const icon = dom.leftSidebarToggle.querySelector('svg');
  if (!icon) return;
  if (isCollapsed) {
    icon.innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>';
    dom.leftSidebarToggle.title = 'Expand sidebar';
  } else {
    icon.innerHTML = '<polyline points="15 18 9 12 15 6"></polyline>';
    dom.leftSidebarToggle.title = 'Collapse sidebar';
  }
}
