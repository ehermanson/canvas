import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSavedLayouts } from './use-saved-layouts';

const STORAGE_KEY = 'picture-hanging-layouts';
const LOADED_LAYOUT_KEY = 'picture-hanging-loaded-layout-id';

describe('useSavedLayouts', () => {
  let mockLocalStorage: Record<string, string>;
  let mockSessionStorage: Record<string, string>;
  let mockLocationSearch: string;

  beforeEach(() => {
    mockLocalStorage = {};
    mockSessionStorage = {};
    mockLocationSearch = '?test=1';

    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === STORAGE_KEY) return mockLocalStorage[key] ?? null;
      if (key === LOADED_LAYOUT_KEY) return mockSessionStorage[key] ?? null;
      return null;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key === STORAGE_KEY) {
        mockLocalStorage[key] = value;
      } else if (key === LOADED_LAYOUT_KEY) {
        mockSessionStorage[key] = value;
      }
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      if (key === STORAGE_KEY) {
        delete mockLocalStorage[key];
      } else if (key === LOADED_LAYOUT_KEY) {
        delete mockSessionStorage[key];
      }
    });

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        search: mockLocationSearch,
      },
      writable: true,
    });

    // Mock crypto.randomUUID
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '12345678-1234-1234-1234-123456789012',
    );

    // Mock Date.now
    vi.spyOn(Date, 'now').mockReturnValue(1000000);

    // Suppress interval from running
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('starts with empty layouts when localStorage is empty', () => {
      const { result } = renderHook(() => useSavedLayouts());
      expect(result.current.layouts).toEqual([]);
    });

    it('loads layouts from localStorage on mount', () => {
      const existingLayouts = [
        {
          id: 'existing-1',
          title: 'Test Layout',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());
      expect(result.current.layouts).toEqual(existingLayouts);
    });

    it('handles invalid JSON in localStorage gracefully', () => {
      mockLocalStorage[STORAGE_KEY] = 'invalid json {{{';

      const { result } = renderHook(() => useSavedLayouts());
      expect(result.current.layouts).toEqual([]);
    });

    it('restores loadedLayoutId from sessionStorage', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Test Layout',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);
      mockSessionStorage[LOADED_LAYOUT_KEY] = 'layout-1';

      const { result } = renderHook(() => useSavedLayouts());
      expect(result.current.loadedLayout).toEqual(existingLayouts[0]);
    });
  });

  describe('save', () => {
    it('saves a new layout successfully', () => {
      const { result } = renderHook(() => useSavedLayouts());

      let saveResult: { success: boolean; error?: string };
      act(() => {
        saveResult = result.current.save('My Layout');
      });

      expect(saveResult!.success).toBe(true);
      expect(result.current.layouts).toHaveLength(1);
      expect(result.current.layouts[0]).toMatchObject({
        id: '12345678-1234-1234-1234-123456789012',
        title: 'My Layout',
        url: '?test=1',
        createdAt: 1000000,
        updatedAt: 1000000,
      });
    });

    it('trims whitespace from title', () => {
      const { result } = renderHook(() => useSavedLayouts());

      act(() => {
        result.current.save('  Padded Title  ');
      });

      expect(result.current.layouts[0].title).toBe('Padded Title');
    });

    it('uses "Untitled Layout" for empty title', () => {
      const { result } = renderHook(() => useSavedLayouts());

      act(() => {
        result.current.save('   ');
      });

      expect(result.current.layouts[0].title).toBe('Untitled Layout');
    });

    it('rejects duplicate names (case insensitive)', () => {
      const existingLayouts = [
        {
          id: 'existing-1',
          title: 'My Layout',
          url: '?other=url',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      let saveResult: { success: boolean; error?: string };
      act(() => {
        saveResult = result.current.save('my layout'); // lowercase
      });

      expect(saveResult!.success).toBe(false);
      expect(saveResult!.error).toBe('A layout with this name already exists');
    });

    it('rejects saving duplicate configuration', () => {
      const existingLayouts = [
        {
          id: 'existing-1',
          title: 'Existing Layout',
          url: '?test=1', // Same as current URL
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      let saveResult: { success: boolean; error?: string };
      act(() => {
        saveResult = result.current.save('New Name');
      });

      expect(saveResult!.success).toBe(false);
      expect(saveResult!.error).toBe(
        'This configuration is already saved as "Existing Layout"',
      );
    });

    it('sets the saved layout as loaded layout', () => {
      const { result } = renderHook(() => useSavedLayouts());

      act(() => {
        result.current.save('My Layout');
      });

      expect(result.current.loadedLayout?.id).toBe('12345678-1234-1234-1234-123456789012');
      expect(mockSessionStorage[LOADED_LAYOUT_KEY]).toBe('12345678-1234-1234-1234-123456789012');
    });

    it('persists to localStorage', () => {
      const { result } = renderHook(() => useSavedLayouts());

      act(() => {
        result.current.save('My Layout');
      });

      const stored = JSON.parse(mockLocalStorage[STORAGE_KEY]);
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('My Layout');
    });
  });

  describe('update', () => {
    it('updates an existing layout with current config', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'My Layout',
          url: '?old=config',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      let updateResult: { success: boolean; error?: string };
      act(() => {
        updateResult = result.current.update('layout-1');
      });

      expect(updateResult!.success).toBe(true);
      expect(result.current.layouts[0].url).toBe('?test=1');
      expect(result.current.layouts[0].updatedAt).toBe(1000000);
    });

    it('rejects update if config exists in another layout', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Layout 1',
          url: '?old=config',
          createdAt: 500000,
          updatedAt: 500000,
        },
        {
          id: 'layout-2',
          title: 'Layout 2',
          url: '?test=1', // Same as current URL
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      let updateResult: { success: boolean; error?: string };
      act(() => {
        updateResult = result.current.update('layout-1');
      });

      expect(updateResult!.success).toBe(false);
      expect(updateResult!.error).toBe(
        'This configuration is already saved as "Layout 2"',
      );
    });
  });

  describe('rename', () => {
    it('renames a layout successfully', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Old Name',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      let renameResult: { success: boolean; error?: string };
      act(() => {
        renameResult = result.current.rename('layout-1', 'New Name');
      });

      expect(renameResult!.success).toBe(true);
      expect(result.current.layouts[0].title).toBe('New Name');
      expect(result.current.layouts[0].updatedAt).toBe(1000000);
    });

    it('rejects empty name', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Old Name',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      let renameResult: { success: boolean; error?: string };
      act(() => {
        renameResult = result.current.rename('layout-1', '   ');
      });

      expect(renameResult!.success).toBe(false);
      expect(renameResult!.error).toBe('Name cannot be empty');
    });

    it('rejects duplicate name (excluding self)', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Layout 1',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
        {
          id: 'layout-2',
          title: 'Layout 2',
          url: '?baz=qux',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      let renameResult: { success: boolean; error?: string };
      act(() => {
        renameResult = result.current.rename('layout-1', 'Layout 2');
      });

      expect(renameResult!.success).toBe(false);
      expect(renameResult!.error).toBe(
        'A layout with this name already exists',
      );
    });

    it('allows renaming to same name (case change)', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'my layout',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      let renameResult: { success: boolean; error?: string };
      act(() => {
        renameResult = result.current.rename('layout-1', 'My Layout');
      });

      expect(renameResult!.success).toBe(true);
      expect(result.current.layouts[0].title).toBe('My Layout');
    });
  });

  describe('remove', () => {
    it('removes a layout', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Layout 1',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
        {
          id: 'layout-2',
          title: 'Layout 2',
          url: '?baz=qux',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      act(() => {
        result.current.remove('layout-1');
      });

      expect(result.current.layouts).toHaveLength(1);
      expect(result.current.layouts[0].id).toBe('layout-2');
    });

    it('clears loadedLayoutId if deleted layout was loaded', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Layout 1',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);
      mockSessionStorage[LOADED_LAYOUT_KEY] = 'layout-1';

      const { result } = renderHook(() => useSavedLayouts());

      act(() => {
        result.current.remove('layout-1');
      });

      expect(result.current.loadedLayout).toBeNull();
    });
  });

  describe('isNameTaken', () => {
    it('returns true for existing name (case insensitive)', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'My Layout',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      expect(result.current.isNameTaken('my layout')).toBe(true);
      expect(result.current.isNameTaken('MY LAYOUT')).toBe(true);
    });

    it('returns false for non-existing name', () => {
      const { result } = renderHook(() => useSavedLayouts());
      expect(result.current.isNameTaken('New Name')).toBe(false);
    });

    it('excludes specified ID from check', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'My Layout',
          url: '?foo=bar',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      expect(result.current.isNameTaken('My Layout', 'layout-1')).toBe(false);
    });
  });

  describe('existingLayoutForCurrentConfig', () => {
    it('returns layout matching current URL', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Layout 1',
          url: '?test=1', // Matches current URL
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      expect(result.current.existingLayoutForCurrentConfig?.id).toBe(
        'layout-1',
      );
    });

    it('returns null when no match', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Layout 1',
          url: '?other=url',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);

      const { result } = renderHook(() => useSavedLayouts());

      expect(result.current.existingLayoutForCurrentConfig).toBeNull();
    });
  });

  describe('hasUnsavedChanges', () => {
    it('returns false when no layout is loaded', () => {
      const { result } = renderHook(() => useSavedLayouts());
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('returns false when loaded layout matches current URL', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Layout 1',
          url: '?test=1', // Same as current
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);
      mockSessionStorage[LOADED_LAYOUT_KEY] = 'layout-1';

      const { result } = renderHook(() => useSavedLayouts());

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('returns true when loaded layout differs from current URL', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Layout 1',
          url: '?old=config', // Different from current
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);
      mockSessionStorage[LOADED_LAYOUT_KEY] = 'layout-1';

      const { result } = renderHook(() => useSavedLayouts());

      expect(result.current.hasUnsavedChanges).toBe(true);
    });
  });

  describe('startFresh', () => {
    it('clears loadedLayoutId and sets detached state', () => {
      const existingLayouts = [
        {
          id: 'layout-1',
          title: 'Layout 1',
          url: '?test=1',
          createdAt: 500000,
          updatedAt: 500000,
        },
      ];
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(existingLayouts);
      mockSessionStorage[LOADED_LAYOUT_KEY] = 'layout-1';

      const { result } = renderHook(() => useSavedLayouts());

      // Before startFresh, existingLayoutForCurrentConfig should match
      expect(result.current.existingLayoutForCurrentConfig?.id).toBe(
        'layout-1',
      );

      act(() => {
        result.current.startFresh();
      });

      expect(result.current.loadedLayout).toBeNull();
      // After startFresh (detached), existingLayoutForCurrentConfig returns null
      expect(result.current.existingLayoutForCurrentConfig).toBeNull();
    });
  });
});
