import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import Home from '../routes/Home';
import { vi } from 'vitest';

vi.spyOn(console, 'error').mockImplementation(() => {});

describe('router', () => {
  it('renders home component at root', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('renders editor component', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(screen.getByText('Add Node')).toBeInTheDocument();
  });
});
