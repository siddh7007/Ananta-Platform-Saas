/**
 * Help Context Provider
 * CBP-P2-010: Help Center & Documentation Integration
 *
 * Provides contextual help functionality throughout the application,
 * including relevant articles based on current page context.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { HelpSidebar } from './HelpSidebar';

export interface HelpArticle {
  id: string;
  title: string;
  url: string;
  category: string;
  description?: string;
  keywords?: string[];
}

interface HelpContextType {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  relevantArticles: HelpArticle[];
  allArticles: HelpArticle[];
  openHelp: () => void;
  closeHelp: () => void;
  isHelpOpen: boolean;
  openArticle: (articleId: string) => void;
  searchArticles: (query: string) => HelpArticle[];
}

const HelpContext = createContext<HelpContextType | null>(null);

// Help articles organized by page context
const HELP_ARTICLES: Record<string, HelpArticle[]> = {
  dashboard: [
    {
      id: 'dash-1',
      title: 'Understanding Your Dashboard',
      url: '/docs/dashboard-overview',
      category: 'Getting Started',
      description: 'Learn how to use the dashboard to monitor your BOMs and team activity.',
      keywords: ['dashboard', 'overview', 'metrics'],
    },
    {
      id: 'dash-2',
      title: 'Dashboard Widgets Guide',
      url: '/docs/dashboard-widgets',
      category: 'Features',
      description: 'Customize your dashboard with widgets that matter to you.',
      keywords: ['widgets', 'customize', 'analytics'],
    },
  ],
  'bom-upload': [
    {
      id: 'upload-1',
      title: 'How to Upload a BOM',
      url: '/docs/upload-bom',
      category: 'Getting Started',
      description: 'Step-by-step guide to uploading your first BOM file.',
      keywords: ['upload', 'import', 'bom', 'file'],
    },
    {
      id: 'upload-2',
      title: 'Supported File Formats',
      url: '/docs/file-formats',
      category: 'Reference',
      description: 'Learn about supported file formats: Excel, CSV, and more.',
      keywords: ['format', 'excel', 'csv', 'xlsx'],
    },
    {
      id: 'upload-3',
      title: 'Column Mapping Guide',
      url: '/docs/column-mapping',
      category: 'Guides',
      description: 'Map your BOM columns to our standard format for best results.',
      keywords: ['columns', 'mapping', 'fields'],
    },
  ],
  'bom-list': [
    {
      id: 'bom-1',
      title: 'Managing Your BOMs',
      url: '/docs/bom-management',
      category: 'Guides',
      description: 'Organize, search, and manage your BOM library effectively.',
      keywords: ['bom', 'manage', 'organize', 'list'],
    },
    {
      id: 'bom-2',
      title: 'BOM Status Explained',
      url: '/docs/bom-status',
      category: 'Reference',
      description: 'Understand draft, active, enriched, and archived statuses.',
      keywords: ['status', 'draft', 'active', 'enriched'],
    },
  ],
  'bom-detail': [
    {
      id: 'detail-1',
      title: 'Understanding Line Items',
      url: '/docs/line-items',
      category: 'Guides',
      description: 'Learn about BOM line items and enrichment data.',
      keywords: ['line items', 'components', 'parts'],
    },
    {
      id: 'detail-2',
      title: 'Editing BOM Components',
      url: '/docs/edit-components',
      category: 'Guides',
      description: 'How to edit, add, and remove components from your BOM.',
      keywords: ['edit', 'modify', 'update'],
    },
  ],
  enrichment: [
    {
      id: 'enrich-1',
      title: 'Understanding Enrichment',
      url: '/docs/enrichment',
      category: 'Concepts',
      description: 'What is component enrichment and how does it work?',
      keywords: ['enrichment', 'data', 'matching'],
    },
    {
      id: 'enrich-2',
      title: 'Enrichment Quality Scores',
      url: '/docs/quality-scores',
      category: 'Reference',
      description: 'Understanding match quality and confidence scores.',
      keywords: ['quality', 'score', 'confidence'],
    },
    {
      id: 'enrich-3',
      title: 'Troubleshooting Enrichment',
      url: '/docs/enrich-errors',
      category: 'Troubleshooting',
      description: 'Common enrichment issues and how to resolve them.',
      keywords: ['error', 'troubleshoot', 'fix'],
    },
  ],
  search: [
    {
      id: 'search-1',
      title: 'Advanced Search Techniques',
      url: '/docs/search',
      category: 'Guides',
      description: 'Master the component search with filters and operators.',
      keywords: ['search', 'find', 'filter'],
    },
    {
      id: 'search-2',
      title: 'Parametric Filtering',
      url: '/docs/parametric',
      category: 'Reference',
      description: 'Filter components by electrical specifications.',
      keywords: ['parametric', 'specs', 'filter'],
    },
    {
      id: 'search-3',
      title: 'Saved Searches',
      url: '/docs/saved-searches',
      category: 'Features',
      description: 'Save and reuse your favorite search queries.',
      keywords: ['saved', 'favorite', 'bookmark'],
    },
  ],
  compare: [
    {
      id: 'compare-1',
      title: 'Comparing Components',
      url: '/docs/compare-components',
      category: 'Features',
      description: 'Compare up to 4 components side by side.',
      keywords: ['compare', 'difference', 'side by side'],
    },
    {
      id: 'compare-2',
      title: 'Finding Alternatives',
      url: '/docs/alternatives',
      category: 'Guides',
      description: 'How to find alternative components for your BOM.',
      keywords: ['alternative', 'replacement', 'substitute'],
    },
  ],
  settings: [
    {
      id: 'settings-1',
      title: 'Organization Settings',
      url: '/docs/org-settings',
      category: 'Administration',
      description: 'Configure your organization profile and preferences.',
      keywords: ['settings', 'organization', 'profile'],
    },
    {
      id: 'settings-2',
      title: 'Team Management',
      url: '/docs/team-management',
      category: 'Administration',
      description: 'Invite team members and manage roles.',
      keywords: ['team', 'invite', 'roles', 'users'],
    },
    {
      id: 'settings-3',
      title: 'API Access',
      url: '/docs/api-access',
      category: 'Developer',
      description: 'Generate API keys and access the REST API.',
      keywords: ['api', 'key', 'developer'],
    },
  ],
  export: [
    {
      id: 'export-1',
      title: 'Exporting BOM Data',
      url: '/docs/export-bom',
      category: 'Features',
      description: 'Export your BOM to Excel, CSV, JSON, or XML.',
      keywords: ['export', 'download', 'excel', 'csv'],
    },
    {
      id: 'export-2',
      title: 'Export Templates',
      url: '/docs/export-templates',
      category: 'Features',
      description: 'Create reusable export templates for your workflow.',
      keywords: ['template', 'preset', 'format'],
    },
  ],
  general: [
    {
      id: 'gen-1',
      title: 'Getting Started Guide',
      url: '/docs/getting-started',
      category: 'Getting Started',
      description: 'New to the platform? Start here!',
      keywords: ['start', 'begin', 'new', 'introduction'],
    },
    {
      id: 'gen-2',
      title: 'Keyboard Shortcuts',
      url: '/docs/shortcuts',
      category: 'Reference',
      description: 'Speed up your workflow with keyboard shortcuts.',
      keywords: ['keyboard', 'shortcuts', 'hotkeys'],
    },
    {
      id: 'gen-3',
      title: 'Contact Support',
      url: '/docs/support',
      category: 'Support',
      description: 'Need help? Contact our support team.',
      keywords: ['support', 'help', 'contact'],
    },
  ],
};

// Map routes to help contexts
const ROUTE_TO_CONTEXT: Record<string, string> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/boms': 'bom-list',
  '/boms/upload': 'bom-upload',
  '/components': 'search',
  '/components/search': 'search',
  '/components/compare': 'compare',
  '/settings': 'settings',
  '/settings/organization': 'settings',
  '/settings/team': 'settings',
};

function getContextFromRoute(pathname: string): string {
  // Check for exact match first
  if (ROUTE_TO_CONTEXT[pathname]) {
    return ROUTE_TO_CONTEXT[pathname];
  }

  // Check for BOM detail page
  if (pathname.match(/^\/boms\/[^/]+$/)) {
    return 'bom-detail';
  }

  // Check for enrichment pages
  if (pathname.includes('enrich')) {
    return 'enrichment';
  }

  // Check for export pages
  if (pathname.includes('export')) {
    return 'export';
  }

  // Default to general
  return 'general';
}

function getAllArticles(): HelpArticle[] {
  const all: HelpArticle[] = [];
  const seen = new Set<string>();

  Object.values(HELP_ARTICLES).forEach((articles) => {
    articles.forEach((article) => {
      if (!seen.has(article.id)) {
        seen.add(article.id);
        all.push(article);
      }
    });
  });

  return all;
}

interface HelpProviderProps {
  children: ReactNode;
}

export function HelpProvider({ children }: HelpProviderProps) {
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState('general');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Update current page based on route
  useEffect(() => {
    const context = getContextFromRoute(location.pathname);
    setCurrentPage(context);
  }, [location.pathname]);

  // Keyboard shortcut to open help (? key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if ? key is pressed (shift + /)
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Don't trigger if user is typing in an input
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }

        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const relevantArticles = [
    ...(HELP_ARTICLES[currentPage] || []),
    ...(currentPage !== 'general' ? HELP_ARTICLES.general.slice(0, 2) : []),
  ];

  const allArticles = getAllArticles();

  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);

  const openArticle = useCallback((articleId: string) => {
    const article = allArticles.find((a) => a.id === articleId);
    if (article) {
      window.open(article.url, '_blank', 'noopener,noreferrer');
    }
  }, [allArticles]);

  const searchArticles = useCallback(
    (query: string): HelpArticle[] => {
      if (!query.trim()) return [];

      const lowerQuery = query.toLowerCase();
      return allArticles.filter(
        (article) =>
          article.title.toLowerCase().includes(lowerQuery) ||
          article.description?.toLowerCase().includes(lowerQuery) ||
          article.keywords?.some((k) => k.toLowerCase().includes(lowerQuery)) ||
          article.category.toLowerCase().includes(lowerQuery)
      );
    },
    [allArticles]
  );

  return (
    <HelpContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        relevantArticles,
        allArticles,
        openHelp,
        closeHelp,
        isHelpOpen,
        openArticle,
        searchArticles,
      }}
    >
      {children}
      <HelpSidebar open={isHelpOpen} onOpenChange={setIsHelpOpen} />
    </HelpContext.Provider>
  );
}

export function useHelp(): HelpContextType {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
}

export default HelpProvider;
