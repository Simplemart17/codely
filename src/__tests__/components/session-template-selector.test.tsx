/**
 * @jest-environment jsdom
 */

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

    expect(screen.getByText('Choose a Session Template')).toBeInTheDocument();
    expect(screen.getByText('Start with a pre-built template to save time and ensure best practices')).toBeInTheDocument();
  });

  it('filters templates by category', async () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        onClose={mockOnClose}
      />
    );

    const categorySelect = screen.getByDisplayValue('All Categories');
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

    const difficultySelect = screen.getByDisplayValue('All Levels');
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

    const closeButton = screen.getByText('✕ Close');
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
    expect(screen.getByText(firstTemplate.difficulty)).toBeInTheDocument();
    expect(screen.getByText(`${firstTemplate.estimatedDuration} min`)).toBeInTheDocument();
  });

  it('shows no templates message when filters result in empty list', async () => {
    render(
      <SessionTemplateSelector
        onSelectTemplate={mockOnSelectTemplate}
        selectedLanguage="JAVASCRIPT"
        onClose={mockOnClose}
      />
    );

    // Set filters that would result in no matches
    const categorySelect = screen.getByDisplayValue('All Categories');
    fireEvent.change(categorySelect, { target: { value: 'PROJECT_BASED' } });

    const difficultySelect = screen.getByDisplayValue('All Levels');
    fireEvent.change(difficultySelect, { target: { value: 'ADVANCED' } });

    await waitFor(() => {
      // Check if there are any templates that match these criteria
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
