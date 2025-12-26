# CNS Dashboard Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

## Test File Organization

```
src/
├── __tests__/
│   ├── components/       # Component tests
│   ├── config/          # Configuration tests
│   ├── hooks/           # Custom hook tests
│   ├── integration/     # Integration tests
│   ├── lib/             # Library tests
│   ├── pages/           # Page tests
│   ├── types/           # Type definition tests
│   └── utils/           # Utility function tests
└── setupTests.ts        # Global test setup
```

## Writing Tests

### Component Test Template

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YourComponent } from '../../components/YourComponent';

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle user interactions', () => {
    const handleClick = vi.fn();
    render(<YourComponent onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Hook Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useYourHook } from '../../hooks/useYourHook';

describe('useYourHook', () => {
  it('should return expected value', () => {
    const { result } = renderHook(() => useYourHook());
    expect(result.current).toBeDefined();
  });

  it('should update on action', () => {
    const { result } = renderHook(() => useYourHook());

    act(() => {
      result.current.updateValue('new value');
    });

    expect(result.current.value).toBe('new value');
  });
});
```

### API Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

global.fetch = vi.fn();

describe('API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch data successfully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const result = await fetchData();
    expect(result).toBeDefined();
  });
});
```

## Common Testing Patterns

### 1. Mocking React Router

```typescript
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});
```

### 2. Mocking API Calls

```typescript
global.fetch = vi.fn().mockResolvedValueOnce({
  ok: true,
  status: 200,
  json: async () => ({ data: [] }),
});
```

### 3. Testing Async Components

```typescript
it('should load data', async () => {
  render(<AsyncComponent />);

  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

### 4. Testing User Events

```typescript
import userEvent from '@testing-library/user-event';

it('should handle typing', async () => {
  const user = userEvent.setup();
  render(<Input />);

  await user.type(screen.getByRole('textbox'), 'Hello');
  expect(screen.getByRole('textbox')).toHaveValue('Hello');
});
```

### 5. Testing Error States

```typescript
it('should display error message', () => {
  render(<Component error="Something went wrong" />);
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

## Best Practices

### Do's

1. **Test user behavior, not implementation**
   ```typescript
   // Good
   expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();

   // Bad
   expect(wrapper.find('.submit-button')).toHaveLength(1);
   ```

2. **Use semantic queries**
   ```typescript
   // Preferred order
   screen.getByRole('button')
   screen.getByLabelText('Email')
   screen.getByText('Submit')
   screen.getByTestId('custom-element')
   ```

3. **Keep tests isolated**
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
     localStorage.clear();
   });
   ```

4. **Use descriptive test names**
   ```typescript
   // Good
   it('should display error message when API call fails', () => {});

   // Bad
   it('test error', () => {});
   ```

5. **Test edge cases**
   ```typescript
   it('should handle empty array', () => {});
   it('should handle null values', () => {});
   it('should handle very large numbers', () => {});
   ```

### Don'ts

1. **Don't test implementation details**
   ```typescript
   // Bad
   expect(component.state.isLoading).toBe(false);

   // Good
   expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
   ```

2. **Don't use snapshots excessively**
   - Use for stable UI components only
   - Avoid for dynamic content
   - Keep snapshots small

3. **Don't share state between tests**
   ```typescript
   // Bad
   let sharedData;
   it('test 1', () => { sharedData = 'test'; });
   it('test 2', () => { expect(sharedData).toBe('test'); });

   // Good - each test is independent
   it('test 1', () => {
     const data = 'test';
     expect(data).toBe('test');
   });
   ```

4. **Don't over-mock**
   - Only mock external dependencies
   - Keep component internals real
   - Avoid mocking utility functions

5. **Don't ignore warnings**
   - Fix React warnings
   - Address console errors
   - Update deprecated APIs

## Debugging Tests

### Run single test file
```bash
npm test -- useDebounce.test.ts
```

### Run tests matching pattern
```bash
npm test -- --grep "should render"
```

### Debug in VS Code

Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--run"],
  "console": "integratedTerminal"
}
```

### View test output
```bash
# Verbose mode
npm test -- --reporter=verbose

# Show console logs
npm test -- --silent=false
```

## Coverage Reports

### Generate HTML report
```bash
npm run test:coverage
```

View report: `coverage/index.html`

### Check coverage thresholds
```typescript
// vitest.config.ts
coverage: {
  lines: 70,
  functions: 70,
  branches: 60,
  statements: 70,
}
```

## Common Issues

### Issue: Tests fail with "Cannot find module"

**Solution**: Check import paths and exports
```typescript
// Verify export exists
export { MyComponent } from './MyComponent';

// Update import path if needed
import { MyComponent } from '../../components/MyComponent';
```

### Issue: "not wrapped in act(...)"

**Solution**: Use `act()` for state updates
```typescript
import { act } from '@testing-library/react';

act(() => {
  result.current.updateState('new value');
});
```

### Issue: Tests timeout

**Solution**: Increase timeout or fix async handling
```typescript
it('should complete', async () => {
  await waitFor(() => {
    expect(screen.getByText('Done')).toBeInTheDocument();
  }, { timeout: 5000 });
});
```

### Issue: Flaky tests

**Solution**: Add proper waits and isolation
```typescript
beforeEach(() => {
  vi.clearAllTimers();
  vi.clearAllMocks();
});
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [React Testing Patterns](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Best Practices](https://testingjavascript.com/)

## Contributing

When adding new tests:

1. Place test file adjacent to source file or in `__tests__` directory
2. Follow naming convention: `*.test.ts` or `*.test.tsx`
3. Include descriptive test names
4. Add comments for complex test logic
5. Ensure tests pass before committing
6. Update this guide if adding new patterns
