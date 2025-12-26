import React from 'react';
import { useTouchDevice } from '../../hooks/useTouchDevice';

export interface ResponsiveContainerProps {
  children?: React.ReactNode;
  desktopLayout?: React.ReactNode;
  tabletLayout?: React.ReactNode;
  mobileLayout?: React.ReactNode;
  className?: string;
}

/**
 * ResponsiveContainer - Switches between layouts based on device type
 *
 * @example
 * <ResponsiveContainer
 *   desktopLayout={<DesktopTable />}
 *   tabletLayout={<TabletCardGrid />}
 *   mobileLayout={<MobileList />}
 * />
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  desktopLayout,
  tabletLayout,
  mobileLayout,
  className = '',
}) => {
  const { isTablet, isMobile, isDesktop } = useTouchDevice();

  // Determine which layout to render
  let content: React.ReactNode = children;

  if (isMobile && mobileLayout) {
    content = mobileLayout;
  } else if (isTablet && tabletLayout) {
    content = tabletLayout;
  } else if (isDesktop && desktopLayout) {
    content = desktopLayout;
  }

  return (
    <div className={`responsive-container ${className}`}>
      {content}
    </div>
  );
};

export default ResponsiveContainer;
