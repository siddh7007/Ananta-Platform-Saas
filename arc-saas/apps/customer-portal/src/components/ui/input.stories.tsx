import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { InputWrapper } from './input';
import { Search, Mail, User, Lock, AlertCircle, DollarSign } from 'lucide-react';

const meta = {
  title: 'UI/InputWrapper',
  component: InputWrapper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    leftIcon: {
      control: false,
      description: 'Icon element to display on the left side',
    },
    rightIcon: {
      control: false,
      description: 'Icon element to display on the right side',
    },
    clearable: {
      control: 'boolean',
      description: 'Shows clear button when input has value',
    },
    showCounter: {
      control: 'boolean',
      description: 'Shows character counter (requires maxLength)',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
    hint: {
      control: 'text',
      description: 'Helper text below input',
    },
  },
} satisfies Meta<typeof InputWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic story with state management
function InputWithState(args: any) {
  const [value, setValue] = useState('');

  return (
    <div className="w-[400px]">
      <InputWrapper
        {...args}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClear={() => setValue('')}
      />
    </div>
  );
}

// Default
export const Default: Story = {
  render: () => <InputWithState placeholder="Enter text..." />,
};

// With left icon
export const WithLeftIcon: Story = {
  render: () => (
    <InputWithState
      leftIcon={<Search className="h-4 w-4" />}
      placeholder="Search components..."
      clearable
    />
  ),
};

// With error
export const WithError: Story = {
  render: () => {
    const [value, setValue] = useState('invalid-email');
    return (
      <div className="w-[400px]">
        <InputWrapper
          leftIcon={<Mail className="h-4 w-4" />}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error="Please enter a valid email address"
          clearable
          onClear={() => setValue('')}
        />
      </div>
    );
  },
};

// With character counter
export const WithCharacterCounter: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-[400px]">
        <InputWrapper
          leftIcon={<User className="h-4 w-4" />}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={50}
          showCounter
          hint="Enter your full name"
          clearable
          onClear={() => setValue('')}
        />
      </div>
    );
  },
};

// Near limit
export const NearLimit: Story = {
  render: () => {
    const [value, setValue] = useState('This text is very close to the maximum character limit');
    return (
      <div className="w-[400px]">
        <InputWrapper
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={50}
          showCounter
          hint="Character count turns red at 90%"
          clearable
          onClear={() => setValue('')}
        />
      </div>
    );
  },
};

// Error with counter
export const ErrorWithCounter: Story = {
  render: () => {
    const [value, setValue] = useState('AB');
    return (
      <div className="w-[400px]">
        <InputWrapper
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={100}
          showCounter
          error={value.length < 3 ? 'Name must be at least 3 characters' : undefined}
          hint="Minimum 3 characters required"
          clearable
          onClear={() => setValue('')}
        />
      </div>
    );
  },
};

// Password field
export const PasswordField: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-[400px]">
        <InputWrapper
          leftIcon={<Lock className="h-4 w-4" />}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={128}
          showCounter
          hint="Minimum 8 characters, including uppercase and lowercase"
        />
      </div>
    );
  },
};

// Disabled state
export const Disabled: Story = {
  render: () => (
    <div className="w-[400px]">
      <InputWrapper
        leftIcon={<User className="h-4 w-4" />}
        value="Disabled input value"
        disabled
        hint="This field is read-only"
      />
    </div>
  ),
};

// Right icon
export const WithRightIcon: Story = {
  render: () => (
    <InputWithState
      leftIcon={<DollarSign className="h-4 w-4" />}
      rightIcon={<AlertCircle className="h-4 w-4" />}
      placeholder="Amount"
      hint="Enter amount in USD"
    />
  ),
};

// All features combined
export const AllFeatures: Story = {
  render: () => {
    const [value, setValue] = useState('Sample BOM Name');
    const error = value.length < 3 && value.length > 0
      ? 'Name must be at least 3 characters'
      : undefined;

    return (
      <div className="w-[400px]">
        <InputWrapper
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={100}
          showCounter
          clearable
          onClear={() => setValue('')}
          error={error}
          hint="A descriptive name for your Bill of Materials"
          placeholder="Enter BOM name"
        />
      </div>
    );
  },
};

// Form example
export const FormExample: Story = {
  render: () => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');

    const emailError = email && !email.includes('@') ? 'Invalid email address' : undefined;
    const nameError = name.length > 0 && name.length < 3 ? 'Name too short' : undefined;
    const passwordError = password.length > 0 && password.length < 8 ? 'Password too short' : undefined;

    return (
      <div className="w-[400px] space-y-6">
        <div>
          <label className="text-sm font-medium mb-2 block">Email</label>
          <InputWrapper
            leftIcon={<Mail className="h-4 w-4" />}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            clearable
            onClear={() => setEmail('')}
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Name</label>
          <InputWrapper
            leftIcon={<User className="h-4 w-4" />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            showCounter
            error={nameError}
            hint="Enter your full name"
            clearable
            onClear={() => setName('')}
            placeholder="John Doe"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Password</label>
          <InputWrapper
            leftIcon={<Lock className="h-4 w-4" />}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={128}
            showCounter
            error={passwordError}
            hint="Minimum 8 characters"
            placeholder="Enter password"
          />
        </div>
      </div>
    );
  },
};
