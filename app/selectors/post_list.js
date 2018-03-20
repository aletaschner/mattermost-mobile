// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {Posts, Preferences} from 'mattermost-redux/constants';
import {makeGetPostsForIds} from 'mattermost-redux/selectors/entities/posts';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {createIdsSelector} from 'mattermost-redux/utils/helpers';
import {shouldFilterJoinLeavePost} from 'mattermost-redux/utils/post_utils';

export const DATE_LINE = 'date-';
export const START_OF_NEW_MESSAGES = 'start-of-new-messages';
export const DELTED_ROOT_POST = 'deleted-root-post';

function shouldShowJoinLeaveMessages(state) {
    // This setting is true or not set if join/leave messages are to be displayed
    return getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_FILTER_JOIN_LEAVE, true);
}

// Returns a selector that, given the state and an object containing an array of postIds and an optional
// timestamp of when the channel was last read, returns a memoized array of postIds interspersed with
// day indicators and an optional new message indicator.
export function makePreparePostIdsForPostList() {
    const getMyPosts = makeGetPostsForIds();

    return createIdsSelector(
        (state, props) => getMyPosts(state, props.postIds),
        (state, props) => props.lastViewedAt,
        (state, props) => props.indicateNewMessages,
        getCurrentUser,
        shouldShowJoinLeaveMessages,
        (posts, lastViewedAt, indicateNewMessages, currentUser, showJoinLeave) => {
            if (posts.length === 0 || !currentUser) {
                return [];
            }

            const out = [];

            let lastDate = null;
            let addedNewMessagesIndicator = false;
            let deletedRootIndicator = null;
            const rootId = posts[0].root_id;
            const hasRootPost = posts.map((post) => post.id).includes(rootId);

            // Iterating through the posts from oldest to newest
            for (let i = posts.length - 1; i >= 0; i--) {
                const post = posts[i];

                if (post.state === Posts.POST_DELETED && post.user_id === currentUser.id) {
                    continue;
                }

                // Filter out join/leave messages if necessary
                if (shouldFilterJoinLeavePost(post, showJoinLeave, currentUser.username)) {
                    continue;
                }

                // Push on a date header if the last post was on a different day than the current one
                const postDate = new Date(post.create_at);

                if (!lastDate || lastDate.toDateString() !== postDate.toDateString()) {
                    out.push(DATE_LINE + postDate.toString());

                    lastDate = postDate;
                }

                if (!deletedRootIndicator && !hasRootPost) {
                    deletedRootIndicator = true;
                    out.push(DELTED_ROOT_POST);
                }

                // Only add the new messages line if a lastViewedAt time is set
                const postIsUnread = post.create_at > lastViewedAt && post.user_id !== currentUser.id;
                if (lastViewedAt !== null && !addedNewMessagesIndicator && postIsUnread && indicateNewMessages) {
                    out.push(START_OF_NEW_MESSAGES);
                    addedNewMessagesIndicator = true;
                }

                out.push(post.id);
            }

            // Flip it back to newest to oldest
            return out.reverse();
        }
    );
}
