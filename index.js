const http = require('http');
const express = require('express');
const { createEventAdapter } = require('@slack/events-api');
const { createMessageAdapter } = require('@slack/interactive-messages');
const { WebClient } = require('@slack/client');
const Game = require('./game');

const port = 5000;

const web = new WebClient(process.env.SLACK_TOKEN);
const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET, {includeBody: 1});
const slackInteractions = createMessageAdapter(process.env.SLACK_SIGNING_SECRET);

// /** @type {Record<any, Record<any, Game>>} */
const games = {};

slackEvents.on('error', console.error);
slackEvents.on('message', (evt, body) => {
    try {
        if (evt.subtype === 'channel_join') {
            console.log(`${evt.user} joined ${evt.channel}`);
            games[evt.channel] || (games[evt.channel] = {});
            const game = games[evt.channel][evt.user] = new Game(web, evt.user, evt.channel);
            game.promptToPlay();
        }
    } catch (e) {
        console.error(e);
    }
});

slackInteractions.action('init', (payload, respond) => {
    try {
        const channelId = payload.actions[0].name;
        const game = games[channelId][payload.user.id];
        if (payload.actions[0].value === 'yes') {
            game.accept(payload, respond);
        } else {
            game.decline(payload, respond);
            delete games[channelId][payload.user.id];
        }
    } catch (e) {
        console.error(e);
    }
});

slackInteractions.action({within: 'dialog', callbackId: 'accept'}, (payload, respond) => {
    try {
        const game = games[payload.state][payload.user.id];
        return game.setChoices(payload, respond);
    } catch (e) {
        console.error(e);
    }
});

slackInteractions.action({within: 'dialog', callbackId: 'guess'}, (payload, respond) => {
    try {
        const [channelId, userId] = payload.actions[0].name.split('/');
        const game = games[channelId][userId];
        game.respondToChoice(payload);
    } catch (e) {
        console.error(e);
    }
});


// Combine both adapters in an express app:
const app = express();
app.use('/events', slackEvents.expressMiddleware());
app.use('/actions', slackInteractions.expressMiddleware());
app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/localhost.mlh.io/activities/build-slack-apps', (req, res) => res.redirect('http://localhost.mlh.io'));

http.createServer(app).listen(port, () => console.log(`server listening on port ${port}`));
