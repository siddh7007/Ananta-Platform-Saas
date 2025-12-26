/**
 * InputWrapper Examples - CBP-P4-005
 *
 * This file demonstrates all the enhanced input features:
 * - Left/right icons
 * - Clear button
 * - Error states
 * - Character counter
 * - Helper text
 */

import React, { useState } from 'react';
import { InputWrapper } from './input';
import { Search, Mail, User, Lock, DollarSign } from 'lucide-react';

export function InputExamples() {
  const [searchValue, setSearchValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [nameValue, setNameValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [bomName, setBomName] = useState('');

  return (
    <div className="space-y-8 p-8 max-w-2xl">
      <h2 className="text-2xl font-bold">Enhanced Input Examples</h2>

      {/* Example 1: Search with left icon and clear button */}
      <div>
        <h3 className="text-lg font-semibold mb-2">1. Search Input</h3>
        <InputWrapper
          leftIcon={<Search className="h-4 w-4" />}
          clearable
          onClear={() => setSearchValue('')}
          placeholder="Search components..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          hint="Search by MPN, manufacturer, or category"
        />
      </div>

      {/* Example 2: Email with validation error */}
      <div>
        <h3 className="text-lg font-semibold mb-2">2. Email with Error</h3>
        <InputWrapper
          leftIcon={<Mail className="h-4 w-4" />}
          type="email"
          placeholder="Enter your email"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          error={
            emailValue && !emailValue.includes('@')
              ? 'Please enter a valid email address'
              : undefined
          }
          clearable
          onClear={() => setEmailValue('')}
        />
      </div>

      {/* Example 3: Name with character counter */}
      <div>
        <h3 className="text-lg font-semibold mb-2">3. Name with Character Counter</h3>
        <InputWrapper
          leftIcon={<User className="h-4 w-4" />}
          placeholder="Enter your name"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          maxLength={50}
          showCounter
          hint="Your full name as it appears on official documents"
          clearable
          onClear={() => setNameValue('')}
        />
      </div>

      {/* Example 4: BOM Name with all features */}
      <div>
        <h3 className="text-lg font-semibold mb-2">4. BOM Name (All Features)</h3>
        <InputWrapper
          placeholder="Enter BOM name"
          value={bomName}
          onChange={(e) => setBomName(e.target.value)}
          maxLength={100}
          showCounter
          clearable
          onClear={() => setBomName('')}
          error={bomName.length < 3 && bomName.length > 0 ? 'Name must be at least 3 characters' : undefined}
          hint="A descriptive name for your Bill of Materials"
        />
      </div>

      {/* Example 5: Password (no clear button when disabled) */}
      <div>
        <h3 className="text-lg font-semibold mb-2">5. Password Input</h3>
        <InputWrapper
          leftIcon={<Lock className="h-4 w-4" />}
          type="password"
          placeholder="Enter password"
          value={passwordValue}
          onChange={(e) => setPasswordValue(e.target.value)}
          maxLength={128}
          showCounter
          hint="Minimum 8 characters, including uppercase, lowercase, and numbers"
        />
      </div>

      {/* Example 6: Currency with right icon (no clear) */}
      <div>
        <h3 className="text-lg font-semibold mb-2">6. Currency Input</h3>
        <InputWrapper
          leftIcon={<DollarSign className="h-4 w-4" />}
          type="number"
          placeholder="0.00"
          hint="Enter amount in USD"
          step="0.01"
        />
      </div>

      {/* Example 7: Disabled state */}
      <div>
        <h3 className="text-lg font-semibold mb-2">7. Disabled Input</h3>
        <InputWrapper
          leftIcon={<User className="h-4 w-4" />}
          value="Disabled input"
          disabled
          hint="This field is read-only"
        />
      </div>

      {/* Example 8: React Hook Form integration example */}
      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="text-lg font-semibold mb-2">React Hook Form Integration</h3>
        <pre className="text-sm overflow-x-auto">
{`// With react-hook-form
import { useForm } from 'react-hook-form';

const { register, formState: { errors } } = useForm();

<InputWrapper
  error={errors.name?.message}
  maxLength={100}
  showCounter
  hint="Enter the BOM name"
  {...register('name', {
    required: 'Name is required',
    minLength: {
      value: 3,
      message: 'Name must be at least 3 characters'
    }
  })}
/>`}
        </pre>
      </div>
    </div>
  );
}
