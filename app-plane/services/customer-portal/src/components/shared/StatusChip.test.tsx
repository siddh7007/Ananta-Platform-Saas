/**
 * StatusChip Tests
 *
 * Tests for StatusChip and related convenience components.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import {
  StatusChip,
  RiskChip,
  GradeChip,
  WorkflowChip,
  AlertTypeChip,
  SeverityChip,
} from './StatusChip';

describe('StatusChip', () => {
  describe('Risk status', () => {
    it('renders low risk correctly', () => {
      render(<StatusChip status={{ category: 'risk', value: 'low' }} />);
      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('renders high risk correctly', () => {
      render(<StatusChip status={{ category: 'risk', value: 'high' }} />);
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('renders critical risk correctly', () => {
      render(<StatusChip status={{ category: 'risk', value: 'critical' }} />);
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('Grade status', () => {
    it('renders grade A correctly', () => {
      render(<StatusChip status={{ category: 'grade', value: 'A' }} />);
      expect(screen.getByText('Grade A')).toBeInTheDocument();
    });

    it('renders grade F correctly', () => {
      render(<StatusChip status={{ category: 'grade', value: 'F' }} />);
      expect(screen.getByText('Grade F')).toBeInTheDocument();
    });
  });

  describe('Workflow status', () => {
    it('renders completed status', () => {
      render(<StatusChip status={{ category: 'workflow', value: 'completed' }} />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders processing status', () => {
      render(<StatusChip status={{ category: 'workflow', value: 'processing' }} />);
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });

    it('renders failed status', () => {
      render(<StatusChip status={{ category: 'workflow', value: 'failed' }} />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('renders mapping_pending with proper formatting', () => {
      render(<StatusChip status={{ category: 'workflow', value: 'mapping_pending' }} />);
      expect(screen.getByText('Mapping Pending')).toBeInTheDocument();
    });
  });

  describe('Alert type status', () => {
    it('renders LIFECYCLE alert type', () => {
      render(<StatusChip status={{ category: 'alertType', value: 'LIFECYCLE' }} />);
      expect(screen.getByText('LIFECYCLE')).toBeInTheDocument();
    });

    it('renders SUPPLY_CHAIN with proper formatting', () => {
      render(<StatusChip status={{ category: 'alertType', value: 'SUPPLY_CHAIN' }} />);
      expect(screen.getByText('SUPPLY CHAIN')).toBeInTheDocument();
    });
  });

  describe('Alert severity status', () => {
    it('renders info severity', () => {
      render(<StatusChip status={{ category: 'alertSeverity', value: 'info' }} />);
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('renders critical severity', () => {
      render(<StatusChip status={{ category: 'alertSeverity', value: 'critical' }} />);
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('Custom label', () => {
    it('uses custom label when provided', () => {
      render(
        <StatusChip
          status={{ category: 'risk', value: 'high' }}
          label="Custom Label"
        />
      );
      expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders outlined variant', () => {
      const { container } = render(
        <StatusChip
          status={{ category: 'risk', value: 'low' }}
          variant="outlined"
        />
      );
      expect(container.querySelector('.MuiChip-outlined')).toBeInTheDocument();
    });

    it('renders filled variant by default', () => {
      const { container } = render(
        <StatusChip status={{ category: 'risk', value: 'low' }} />
      );
      expect(container.querySelector('.MuiChip-filled')).toBeInTheDocument();
    });
  });

  describe('Click handler', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(
        <StatusChip
          status={{ category: 'risk', value: 'low' }}
          onClick={handleClick}
        />
      );

      fireEvent.click(screen.getByText('Low'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});

describe('RiskChip', () => {
  it('renders correctly for each risk level', () => {
    const { rerender } = render(<RiskChip level="low" />);
    expect(screen.getByText('Low')).toBeInTheDocument();

    rerender(<RiskChip level="medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();

    rerender(<RiskChip level="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();

    rerender(<RiskChip level="critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });
});

describe('GradeChip', () => {
  it('renders all grades correctly', () => {
    const grades: Array<'A' | 'B' | 'C' | 'D' | 'F'> = ['A', 'B', 'C', 'D', 'F'];
    const { rerender } = render(<GradeChip grade="A" />);

    grades.forEach((grade) => {
      rerender(<GradeChip grade={grade} />);
      expect(screen.getByText(`Grade ${grade}`)).toBeInTheDocument();
    });
  });
});

describe('WorkflowChip', () => {
  it('renders workflow status correctly', () => {
    render(<WorkflowChip status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});

describe('AlertTypeChip', () => {
  it('renders alert type correctly', () => {
    render(<AlertTypeChip type="LIFECYCLE" />);
    expect(screen.getByText('LIFECYCLE')).toBeInTheDocument();
  });
});

describe('SeverityChip', () => {
  it('renders severity correctly', () => {
    render(<SeverityChip severity="warning" />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });
});
