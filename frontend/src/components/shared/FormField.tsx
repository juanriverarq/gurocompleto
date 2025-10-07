import React from 'react';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Select, Textarea } from 'flowbite-react';
import ValidationMessage from './ValidationMessage';

interface FormFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  error?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'number' | 'date' | 'tel' | 'select' | 'textarea';
  placeholder?: string;
  options?: { value: string; label: string }[];
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  rows?: number;
  helperText?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  error,
  required = false,
  type = 'text',
  placeholder,
  options = [],
  disabled = false,
  readOnly = false,
  className = '',
  rows = 3,
  helperText
}) => {
  const hasError = Boolean(error);
  const fieldClasses = `
    mt-1 text-gray-900 dark:text-white
    ${hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-darkborder focus:ring-blue-500'} 
    ${readOnly ? 'bg-gray-50 dark:bg-gray-700 !text-gray-600 dark:!text-gray-300' : 'bg-white dark:bg-gray-800'}
    ${className}
  `;

  const renderField = () => {
    switch (type) {
      case 'select':
        return (
          <Select
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`${fieldClasses} rounded-[10px] text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-darkborder`}
          >
            {options.map((option, idx) => (
              <option key={`${option.value}-${idx}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );
      
      case 'textarea':
        return (
          <Textarea
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            rows={rows}
            className={`${fieldClasses} rounded-[10px] text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-darkborder`}
          />
        );
      
      default:
        return (
          <Input
            id={id}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            className={`${fieldClasses} rounded-[10px]`}
          />
        );
    }
  };

  return (
    <div className="form-field">
      <Label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-white">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      {renderField()}
      
      {error && <ValidationMessage message={error} type="error" />}
      
      {helperText && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
};

export default FormField; 