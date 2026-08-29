/**
 * Rewritten onto `@testing-library/react-native` in the SDK 54 upgrade.
 *
 * `react-test-renderer` reaches into React internals, so its version must match React's
 * **exactly** — not just the major. Left at 18.3.1 against React 19.1 it failed at import
 * with "Cannot read properties of undefined (reading 'ReactCurrentOwner')"; a caret range
 * later floated it to 19.2.8 against React 19.1.0 and the testing library rejected that
 * too. It is pinned with `--save-exact` to whatever React the Expo SDK ships, and moves
 * only when that does.
 *
 * Going through the testing library rather than driving the renderer directly is what makes
 * that pin the library's problem rather than this file's, and it lets the test assert on
 * what a person would see before falling back to a snapshot.
 */
import { render } from '@testing-library/react-native';

import { ThemedText } from '../ThemedText';

it('renders correctly', () => {
    const { toJSON, getByText } = render(<ThemedText>Snapshot test!</ThemedText>);

    expect(getByText('Snapshot test!')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
});
