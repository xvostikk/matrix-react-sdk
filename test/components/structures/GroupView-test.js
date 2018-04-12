/*
Copyright 2018 New Vector Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const React = require('react');
const ReactDOM = require('react-dom');
const ReactTestUtils = require('react-dom/test-utils');
const expect = require('expect');
import Promise from 'bluebird';

import MockHttpBackend from 'matrix-mock-request';
import MatrixClientPeg from '../../../src/MatrixClientPeg';
const sdk = require('matrix-react-sdk');
import Matrix from 'matrix-js-sdk';

const TestUtils = require('test-utils');
const GroupView = sdk.getComponent('structures.GroupView');
const WrappedGroupView = TestUtils.wrapInMatrixClientContext(GroupView);
const Spinner = sdk.getComponent('elements.Spinner');

/**
 * Call fn before calling componentDidUpdate on a react component instance, inst.
 */
function waitForUpdate(inst) {
    return new Promise((resolve, reject) => {
        const cdu = inst.componentDidUpdate;

        console.info({waitForUpdate: inst.props.groupId});

        inst.componentDidUpdate = (prevProps, prevState, snapshot) => {
            resolve();

            if (cdu) cdu(prevProps, prevState, snapshot);

            inst.componentDidUpdate = cdu;
        };
    });
}

describe.only('GroupView', function() {
    let root;
    let rootElement;
    let httpBackend;
    let summaryResponse;
    let summaryResponseWithComplicatedLongDesc;
    let summaryResponseWithNoLongDesc;
    let summaryResponseWithBadImg;
    let groupId;
    let groupIdEncoded;

    beforeEach(function() {
        TestUtils.beforeEach(this);

        httpBackend = new MockHttpBackend();

        Matrix.request(httpBackend.requestFn);

        MatrixClientPeg.get = () => Matrix.createClient({
            baseUrl: 'https://my.home.server',
            userId: '@me:here',
            accessToken: '123456789',
        });

        summaryResponse = {
            profile: {
                avatar_url: "mxc://someavatarurl",
                is_openly_joinable: true,
                is_public: true,
                long_description: "This is a <b>LONG</b> description.",
                name: "The name of a community",
                short_description: "This is a community",
            },
            user: {
                is_privileged: true, // can edit the group
                is_public: true, // appear as a member to non-members
                is_publicised: true, // display flair
            },
            users_section: {
                roles: {},
                total_user_count_estimate: 0,
                users: [],
            },
            rooms_section: {
                categories: {},
                rooms: [],
                total_room_count_estimate: 0,
            },
        };
        summaryResponseWithNoLongDesc = {
            profile: {
                avatar_url: "mxc://someavatarurl",
                is_openly_joinable: true,
                is_public: true,
                long_description: null,
                name: "The name of a community",
                short_description: "This is a community",
            },
            user: {
                is_privileged: true, // can edit the group
                is_public: true, // appear as a member to non-members
                is_publicised: true, // display flair
            },
            users_section: {
                roles: {},
                total_user_count_estimate: 0,
                users: [],
            },
            rooms_section: {
                categories: {},
                rooms: [],
                total_room_count_estimate: 0,
            },
        };
        summaryResponseWithComplicatedLongDesc = {
            profile: {
                avatar_url: "mxc://someavatarurl",
                is_openly_joinable: true,
                is_public: true,
                long_description: `
<h1>This is a more complicated group page</h1>
<p>With paragraphs</p>
<ul>
    <li>And lists!</li>
    <li>With list items.</li>
</ul>
<p>And also images: <img src="mxc://someimageurl"/></p>`,
                name: "The name of a community",
                short_description: "This is a community",
            },
            user: {
                is_privileged: true, // can edit the group
                is_public: true, // appear as a member to non-members
                is_publicised: true, // display flair
            },
            users_section: {
                roles: {},
                total_user_count_estimate: 0,
                users: [],
            },
            rooms_section: {
                categories: {},
                rooms: [],
                total_room_count_estimate: 0,
            },
        };

        summaryResponseWithBadImg = {
            profile: {
                avatar_url: "mxc://someavatarurl",
                is_openly_joinable: true,
                is_public: true,
                long_description: '<p>Evil image: <img src="http://evilimageurl"/></p>',
                name: "The name of a community",
                short_description: "This is a community",
            },
            user: {
                is_privileged: true, // can edit the group
                is_public: true, // appear as a member to non-members
                is_publicised: true, // display flair
            },
            users_section: {
                roles: {},
                total_user_count_estimate: 0,
                users: [],
            },
            rooms_section: {
                categories: {},
                rooms: [],
                total_room_count_estimate: 0,
            },
        };

        groupId = "+" + Math.random().toString(16).slice(2) + ':domain';
        groupIdEncoded = encodeURIComponent(groupId);

        rootElement = document.createElement('div');
        root = ReactDOM.render(<WrappedGroupView groupId={groupId} />, rootElement);
    });

    afterEach(function() {
        ReactDOM.unmountComponentAtNode(rootElement);
    });

    it('should show a spinner when first displayed', function() {
        ReactTestUtils.findRenderedComponentWithType(root, Spinner);

        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/summary').respond(200, summaryResponse);
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/invited_users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/rooms').respond(200, { chunk: [] });

        return httpBackend.flush(undefined, undefined, 0);
    });

    it('should indicate failure after failed /summary', function() {
        const groupView = ReactTestUtils.findRenderedComponentWithType(root, GroupView);
        const prom = waitForUpdate(groupView).then(() => {
            ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_GroupView_error');
        });

        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/summary').respond(500, {});
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/invited_users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/rooms').respond(200, { chunk: [] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });

    it('should show a group avatar, name, id and short description after successful /summary', function() {
        const groupView = ReactTestUtils.findRenderedComponentWithType(root, GroupView);
        const prom = waitForUpdate(groupView).then(() => {
            ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_GroupView');

            const avatar = ReactTestUtils.findRenderedComponentWithType(root, sdk.getComponent('avatars.GroupAvatar'));
            const img = ReactTestUtils.findRenderedDOMComponentWithTag(avatar, 'img');
            const avatarImgElement = ReactDOM.findDOMNode(img);
            expect(avatarImgElement).toExist();
            expect(avatarImgElement.src).toInclude(
                'https://my.home.server/_matrix/media/v1/thumbnail/' +
                'someavatarurl?width=48&height=48&method=crop',
            );

            const name = ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_GroupView_header_name');
            const nameElement = ReactDOM.findDOMNode(name);
            expect(nameElement).toExist();
            expect(nameElement.innerText).toInclude('The name of a community');
            expect(nameElement.innerText).toInclude(groupId);

            const shortDesc = ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_GroupView_header_shortDesc');
            const shortDescElement = ReactDOM.findDOMNode(shortDesc);
            expect(shortDescElement).toExist();
            expect(shortDescElement.innerText).toBe('This is a community');
        });

        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/summary').respond(200, summaryResponse);
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/invited_users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/rooms').respond(200, { chunk: [] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });

    it('should show a simple long description after successful /summary', function() {
        const groupView = ReactTestUtils.findRenderedComponentWithType(root, GroupView);
        const prom = waitForUpdate(groupView).then(() => {
            ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_GroupView');

            const longDesc = ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_GroupView_groupDesc');
            const longDescElement = ReactDOM.findDOMNode(longDesc);
            expect(longDescElement).toExist();
            expect(longDescElement.innerText).toBe('This is a LONG description.');
            expect(longDescElement.innerHTML).toBe('<div dir="auto">This is a <b>LONG</b> description.</div>');
        });

        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/summary').respond(200, summaryResponse);
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/invited_users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/rooms').respond(200, { chunk: [] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });

    it('should show a placeholder if a long description is not set', function() {
        const groupView = ReactTestUtils.findRenderedComponentWithType(root, GroupView);
        const prom = waitForUpdate(groupView).then(() => {
            const placeholder = ReactTestUtils
                .findRenderedDOMComponentWithClass(root, 'mx_GroupView_groupDesc_placeholder');
            const placeholderElement = ReactDOM.findDOMNode(placeholder);
            expect(placeholderElement).toExist();
        });

        httpBackend
            .when('GET', '/groups/' + groupIdEncoded + '/summary')
            .respond(200, summaryResponseWithNoLongDesc);
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/invited_users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/rooms').respond(200, { chunk: [] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });

    it('should show a complicated long description after successful /summary', function() {
        const groupView = ReactTestUtils.findRenderedComponentWithType(root, GroupView);
        const prom = waitForUpdate(groupView).then(() => {
            const longDesc = ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_GroupView_groupDesc');
            const longDescElement = ReactDOM.findDOMNode(longDesc);
            expect(longDescElement).toExist();

            expect(longDescElement.innerHTML).toInclude('<h1>This is a more complicated group page</h1>');
            expect(longDescElement.innerHTML).toInclude('<p>With paragraphs</p>');
            expect(longDescElement.innerHTML).toInclude('<ul>');
            expect(longDescElement.innerHTML).toInclude('<li>And lists!</li>');

            const imgSrc = "https://my.home.server/_matrix/media/v1/thumbnail/someimageurl?width=800&amp;height=600";
            expect(longDescElement.innerHTML).toInclude('<img src="' + imgSrc + '">');
        });

        httpBackend
            .when('GET', '/groups/' + groupIdEncoded + '/summary')
            .respond(200, summaryResponseWithComplicatedLongDesc);
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/invited_users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/rooms').respond(200, { chunk: [] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });

    it('should disallow images with non-mxc URLs', function() {
        const groupView = ReactTestUtils.findRenderedComponentWithType(root, GroupView);
        const prom = waitForUpdate(groupView).then(() => {
            const longDesc = ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_GroupView_groupDesc');
            const longDescElement = ReactDOM.findDOMNode(longDesc);
            expect(longDescElement).toExist();

            // If this fails, the URL could be in an img `src`, which is what we care about but
            // there's no harm in keeping this simple and checking the entire HTML string.
            expect(longDescElement.innerHTML).toExclude('evilimageurl');
        });

        httpBackend
            .when('GET', '/groups/' + groupIdEncoded + '/summary')
            .respond(200, summaryResponseWithBadImg);
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/invited_users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/rooms').respond(200, { chunk: [] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });
    //mx_RoomDetailList

    it('should show a RoomDetailList after a successful /summary & (empty) /rooms', function() {
        const groupView = ReactTestUtils.findRenderedComponentWithType(root, GroupView);
        const prom = waitForUpdate(groupView).then(() => {
            const roomDetailList = ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_RoomDetailList');
            const roomDetailListElement = ReactDOM.findDOMNode(roomDetailList);
            expect(roomDetailListElement).toExist();
        });

        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/summary').respond(200, summaryResponse);
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/invited_users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/rooms').respond(200, { chunk: [] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });

    it('should show a RoomDetailList after a successful /summary & (empty) /rooms', function() {
        const groupView = ReactTestUtils.findRenderedComponentWithType(root, GroupView);
        const prom = waitForUpdate(groupView).then(() => {
            const roomDetailList = ReactTestUtils.findRenderedDOMComponentWithClass(root, 'mx_RoomDetailList');
            const roomDetailListElement = ReactDOM.findDOMNode(roomDetailList);
            expect(roomDetailListElement).toExist();

            // check for actual room row
        });

        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/summary').respond(200, summaryResponse);
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/invited_users').respond(200, { chunk: [] });
        httpBackend.when('GET', '/groups/' + groupIdEncoded + '/rooms').respond(200, { chunk: [ {
            avatar_url: "mxc://someroomavatarurl",
            canonical_alias: "#somealias:domain",
            guest_can_join: true,
            is_public: true,
            name: "some room naem",
            num_joined_members: 123,
            room_id: "!someroomid",
            topic: "some topic",
            world_readable: true,
        } ] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });
});