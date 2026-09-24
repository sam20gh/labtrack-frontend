/**
 * The rules that are easy to break by accident: that a state which cannot recover never
 * offers a retry, that the artwork stays out of the accessibility tree, and that the
 * server's own wording never becomes the headline.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import StateView from '../StateView';
import { describeError, describeState } from '@/lib/appState';
import { ApiError } from '@/lib/api';

jest.mock('@/lib/auth', () => ({ getAccessToken: jest.fn(async () => null) }));
// StateView reads the live palette, and the appearance preference behind it is stored in
// AsyncStorage, which has no native module under Jest. Rendered outside a ThemeProvider it
// draws in the light scheme, which is what these assertions were written against.
jest.mock('@react-native-async-storage/async-storage', () =>
    // A jest.mock factory is hoisted above imports, so it has to require.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('StateView', () => {
    it('draws the kit\'s badge, title and body for a state', () => {
        render(<StateView state={describeState('offline')} />);
        expect(screen.getByText('No Internet')).toBeTruthy();
        expect(screen.getByText('Please Reconnect')).toBeTruthy();
    });

    it('drops the badge inline, where a second label competes with the header above it', () => {
        render(<StateView state={describeState('offline')} variant="inline" />);
        expect(screen.getByText('No Internet')).toBeTruthy();
        expect(screen.queryByText('Please Reconnect')).toBeNull();
    });

    it('keeps the illustration out of the accessibility tree', () => {
        // 111 unlabelled paths read aloud is worse than silence; the copy below carries
        // everything the drawing says.
        const { UNSAFE_root } = render(<StateView state={describeState('not_found')} />);
        const hidden = UNSAFE_root.findAll((n: { props?: Record<string, unknown> }) => n.props?.accessibilityElementsHidden === true);
        expect(hidden.length).toBeGreaterThan(0);
    });

    it('renders only the actions it was given', () => {
        render(<StateView state={describeState('server_error')} />);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('puts the API\'s own wording below the actions, never in the title', () => {
        const state = describeError(new ApiError('Your report is still being parsed.', 409));
        render(<StateView state={state} />);
        expect(screen.getByText('Your report is still being parsed.')).toBeTruthy();
        // The headline is ours.
        expect(screen.getByText('Server Error')).toBeTruthy();
    });
});
