import '@testing-library/jest-dom';
import { vi } from 'vitest';

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserver);
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({nodes:[], edges:[]}) })) as any);
