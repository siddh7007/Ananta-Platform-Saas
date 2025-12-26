'use client';

import dynamic from 'next/dynamic';
import React from 'react';

/**
 * Next.js Route for React Admin
 *
 * This page integrates React Admin into Next.js using catch-all routes.
 * The [[...params]] pattern allows React Admin to handle all sub-routes.
 *
 * Path: /admin/*
 *
 * Examples:
 * - /admin -> Dashboard
 * - /admin/components -> Component list
 * - /admin/components/123 -> Component show
 * - /admin/components/123/edit -> Component edit
 * - /admin/boms -> BOM list
 * - /admin/alerts -> Alerts list
 */

// Dynamically import React Admin app (client-side only)
const AdminApp = dynamic(() => import('@/admin/App'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666',
      }}
    >
      Loading Admin Interface...
    </div>
  ),
});

/**
 * Admin Page Component
 */
export default function AdminPage() {
  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <AdminApp />
    </div>
  );
}
