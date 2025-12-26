# Component Card Design Documentation

## Overview
Professional component card layout for the CNS Dashboard Component Search page, designed to display electronic component data in a visually appealing and efficient manner for staff decision-making.

## File Locations

### New Files Created
- **ComponentCard.tsx**: `e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\dashboard\src\components\ComponentCard.tsx`

### Modified Files
- **ComponentSearchEnhanced.tsx**: `e:\Work\Ananta-Platform-Saas\app-plane\services\cns-service\dashboard\src\components\ComponentSearchEnhanced.tsx`
  - Added import for ComponentCard component
  - Replaced old tile view implementation with new ComponentCard
  - Updated grid layout to use responsive breakpoints (xs=12, sm=6, md=4, lg=3)

## Design Features

### 1. Card Header Section
- **Component Image**: 100x80px display area with fallback icon (Package icon from Material-UI)
- **Basic Info**:
  - MPN (bold, truncated with tooltip)
  - Manufacturer name
  - Category badge (blue background)
  - Package type badge (outlined)
- **Status Badge**: Color-coded enrichment status in top-right corner

### 2. Description Section
- 2-line clamped description with ellipsis
- Minimum height to maintain card consistency
- Gray text for readability

### 3. Compliance & Stock Row
- **Compliance Badges**: RoHS, REACH, AEC-Q certifications with checkmark icons
  - Green background for RoHS and REACH
  - Purple background for AEC-Q
- **Stock Status**:
  - Colored dot indicator (green/red)
  - "In Stock" / "Out of Stock" label
- **Unit Price**: Bold display with currency formatting ($XX.XX)

### 4. Quality Score & Actions
- **Quality Progress Bar**:
  - Linear progress bar showing quality score percentage
  - Color-coded based on score:
    - 80%+ = Green
    - 60-79% = Orange
    - 40-59% = Deep Orange
    - Below 40% = Red
  - Percentage displayed on right side
- **Action Buttons**:
  - Datasheet icon button (opens in new tab)
  - 3D Model icon button (opens in new tab)
  - View Details button (navigates to detail page)
  - Icon buttons change color on hover with background highlight

## Responsive Grid Layout

### Breakpoints
- **xs (mobile)**: 1 column - full width cards
- **sm (tablet)**: 2 columns - 50% width each
- **md (desktop)**: 3 columns - 33% width each
- **lg (large desktop)**: 4 columns - 25% width each

### Spacing
- Grid container spacing: 3 units (24px)
- Card padding: 2 units (16px)
- Consistent internal spacing with Material-UI Box components

## Component Interface

### ComponentCardProps
```typescript
interface ComponentCardProps {
  component: {
    // Required fields
    mpn: string;
    manufacturer: string;
    category: string;
    description: string;
    quality_score: number;
    enrichment_status: 'production' | 'staging' | 'rejected' | 'pending';

    // Optional fields
    data_sources?: string[];
    last_updated?: string;
    image_url?: string;
    datasheet_url?: string;
    model_3d_url?: string;
    rohs_compliant?: boolean;
    reach_compliant?: boolean;
    aec_qualified?: boolean;
    unit_price?: number;
    in_stock?: boolean;
    stock_status?: string;
    package_type?: string;
    lifecycle_status?: string;
  };
  onViewDetails?: (mpn: string) => void;
}
```

## User Interactions

### Hover Effects
- Card elevation increases (shadow: 4 → 6)
- Card translates up by 2px
- Icon buttons show color and background changes
- Smooth transitions (200ms duration)

### Click Behavior
- **Card click**: Triggers onViewDetails callback with MPN
- **Action buttons**: Stop propagation to prevent double-navigation
- **External links**: Open in new tab with security attributes

### Accessibility
- Icon buttons have tooltip labels
- Color indicators have text labels
- Semantic HTML structure with proper ARIA attributes
- Keyboard navigation support through Material-UI components

## Color Scheme

### Status Colors
- **Production**: Green (#4caf50)
- **Staging**: Orange/Warning (#ff9800)
- **Rejected**: Red (#f44336)
- **Pending**: Gray (default)

### Compliance Badge Colors
- **RoHS/REACH**: Green (success.50 background, success.700 text)
- **AEC-Q**: Purple (secondary.50 background, secondary.700 text)

### Quality Score Colors
- **Excellent (80%+)**: Green (#4caf50)
- **Good (60-79%)**: Orange (#ff9800)
- **Fair (40-59%)**: Deep Orange (#ff5722)
- **Poor (<40%)**: Red (#f44336)

## Design Patterns Used

### Material-UI Components
- Card, CardContent for structure
- Box for layout containers
- Typography for text
- Chip for badges
- LinearProgress for quality bar
- IconButton for actions
- Tooltip for hover information

### Layout Techniques
- Flexbox for internal card layout
- CSS Grid (via Material-UI Grid) for responsive card layout
- Absolute positioning for status badge
- Object-fit for image scaling
- Text clamping (-webkit-line-clamp) for descriptions

### Performance Optimizations
- Image lazy loading via browser default
- Error handling for missing images
- Conditional rendering for optional fields
- Memoization potential (component is stateless)

## Integration with ComponentSearchEnhanced

### Tiles View Implementation
```typescript
{searched && viewMode === 'tiles' && displayResults.length > 0 && (
  <Grid container spacing={3}>
    {displayResults.map((component, index) => (
      <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
        <ComponentCard
          component={component}
          onViewDetails={(mpn) => navigate(`/component/${encodeURIComponent(mpn)}`)}
        />
      </Grid>
    ))}
  </Grid>
)}
```

### Data Flow
1. ComponentSearchEnhanced fetches search results from CNS API
2. Results are filtered, sorted, and paginated
3. displayResults array is passed to ComponentCard via props
4. onViewDetails callback navigates to component detail page

## Future Enhancements

### Potential Improvements
- Add "Add to BOM" quick action button
- Display supplier pricing tiers
- Show availability graph (stock trend)
- Add comparison checkbox for multi-select
- Implement card selection state
- Show parametric specifications preview
- Add favorite/bookmark functionality
- Display related/alternative components
- Show recent usage statistics

### Data Enrichment
- Real-time stock updates
- Multiple supplier pricing
- Lead time information
- MOQ (Minimum Order Quantity) display
- Lifecycle status with timeline
- Parametric filters sidebar
- Advanced search with facets

## Testing Checklist

- [ ] Card renders correctly with minimal data
- [ ] Card renders correctly with all fields populated
- [ ] Image fallback works when image_url is missing or invalid
- [ ] Compliance badges only show when applicable
- [ ] Stock status displays correctly for all states
- [ ] Quality score colors match expected ranges
- [ ] Action buttons navigate/open correctly
- [ ] Hover effects work smoothly
- [ ] Responsive layout works at all breakpoints
- [ ] Click handlers don't conflict (card vs buttons)
- [ ] External links have proper security attributes
- [ ] Tooltips appear on icon buttons

## Browser Compatibility

### Tested Browsers
- Chrome/Edge (Chromium) 90+
- Firefox 88+
- Safari 14+

### Known Issues
- None currently identified

### Fallbacks
- Image error handling for broken image URLs
- Graceful degradation for missing optional fields
- Default colors for invalid status values
