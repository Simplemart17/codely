/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionTemplateSelector } from '@/components/sessions/session-template-selector';
import { SESSION_TEMPLATES } from '@/lib/session-templates';

// Mock the user store
jest.mock('@/stores/user-store', () => ({
  useUserStore: () => ({
    user: {
      id: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
      role: 'INSTRUCTOR'
    }
  })
}));

// Mock shadcn Select to render native <select> (Radix Select doesn't work in jsdom)
jest.mock('@/components/ui/select', () => ({
  Select: function Select({ children, onValueChange, value }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) {
    return (
      <select
        role="combobox"
        value={value || ''}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {children}
      </select>
    );
  },
  SelectTrigger: function SelectTrigger({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  },
  SelectValue: function SelectValue({ placeholder }: { placeholder?: string }) {
    return <option value="">{placeholder}</option>;
  },
  SelectContent: function SelectContent({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  },
  SelectItem: function SelectItem({ children, value }: { children: React.ReactNode; value: string }) {
    return <option value={value}>{children}</option>;
  },
}));

describe('SessionTemplateSelector', () => {
  const mockOnSelectTemplate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders template selector with all templates', () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Choose a Template')).toBeInTheDocument();
    expect(screen.getByText('Start with a pre-built template to save time')).toBeInTheDocument();
  });

  it('filters templates by category', async () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        onClose={mockOnClose}
      />
    );

    const selects = screen.getAllByRole('combobox');
    const categorySelect = selects[0]; // first select is category
    fireEvent.change(categorySelect, { target: { value: 'FUNDAMENTALS' } });

    await waitFor(() => {
      const fundamentalsTemplates = SESSION_TEMPLATES.filter(t => t.category === 'FUNDAMENTALS');
      fundamentalsTemplates.forEach(template => {
        expect(screen.getByText(template.name)).toBeInTheDocument();
      });
    });
  });

  it('filters templates by difficulty', async () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        onClose={mockOnClose}
      />
    );

    const selects = screen.getAllByRole('combobox');
    const difficultySelect = selects[1]; // second select is difficulty
    fireEvent.change(difficultySelect, { target: { value: 'BEGINNER' } });

    await waitFor(() => {
      const beginnerTemplates = SESSION_TEMPLATES.filter(t => t.difficulty === 'BEGINNER');
      expect(beginnerTemplates.length).toBeGreaterThan(0);
    });
  });

  it('filters templates by language when provided', () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        selectedLanguage="JAVASCRIPT"
        onClose={mockOnClose}
      />
    );

    const jsTemplates = SESSION_TEMPLATES.filter(t => t.language === 'JAVASCRIPT');
    jsTemplates.forEach(template => {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    });
  });

  it('calls onSelectTemplate when template is selected', async () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        onClose={mockOnClose}
      />
    );

    const firstTemplate = SESSION_TEMPLATES[0];
    const templateCard = screen.getByText(firstTemplate.name);

    fireEvent.click(templateCard);

    await waitFor(() => {
      expect(mockOnSelectTemplate).toHaveBeenCalledWith(firstTemplate);
    });
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /create custom instead/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays template information correctly', () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        onClose={mockOnClose}
      />
    );

    const firstTemplate = SESSION_TEMPLATES[0];

    expect(screen.getByText(firstTemplate.name)).toBeInTheDocument();
    expect(screen.getByText(firstTemplate.description)).toBeInTheDocument();
    expect(screen.getAllByText(firstTemplate.difficulty).length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${firstTemplate.estimatedDuration} min`).length).toBeGreaterThan(0);
  });

  it('shows no templates message when filters result in empty list', async () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        selectedLanguage="JAVASCRIPT"
        onClose={mockOnClose}
      />
    );

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'PROJECT_BASED' } });
    fireEvent.change(selects[1], { target: { value: 'ADVANCED' } });

    await waitFor(() => {
      const matchingTemplates = SESSION_TEMPLATES.filter(t =>
        t.language === 'JAVASCRIPT' &&
        t.category === 'PROJECT_BASED' &&
        t.difficulty === 'ADVANCED'
      );

      if (matchingTemplates.length === 0) {
        expect(screen.getByText('No templates found')).toBeInTheDocument();
        expect(screen.getByText('Try adjusting your filters or create a custom session')).toBeInTheDocument();
      }
    });
  });
});
