import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({nodes:[], edges:[]}) })) as any);

describe('App UI', () => {
  it('adds node on button click', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    const button = screen.getByText('Add Node');
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalled();
  });
});
