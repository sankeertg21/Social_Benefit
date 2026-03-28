import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock the browser's geolocation API
const mockGeolocation = {
  getCurrentPosition: vi.fn().mockImplementation((success) =>
    success({
      coords: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
    })
  ),
  watchPosition: vi.fn(),
};

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  configurable: true,
});
