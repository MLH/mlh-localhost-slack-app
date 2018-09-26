// Generate a permutation of [0, 1, 2]
function perm3() {
    const i = Math.floor(Math.random() * 3);
    let j = Math.floor(Math.random() * 2);
    if (i === 0 || (i === 1 && j === 1)) j++;
    const k = 3 - i - j;
    return [i, j, k];
}

const revealTime = 1000 * 60 * 60 * 12;

class Game {
    constructor(web, userId, channelId) {
        this.web = web;         // Web API client
        this.userId = userId;
        this.channelId = channelId;
        this.lie = null; // 0, 1 or 2
        this.choices = null; // Array<string>
        this.broadcastTs = null; // ts for the broadcast message
    }

    promptToPlay() {
        const text = ('Hey there, 👋\n'
                      + `I noticed you joined <#${this.channelId}>. `
                      + 'I’m here to help your teammates get to know each other a little better '
                      + 'by playing two truths and a lie.\n'
                      + 'While you’re here, you can help out by filling out your truth and lies 😃');
        const attachments = [{
            text: 'Would you like to play?',
            fallback: 'You’re unable to play 🙁',
            callback_id: 'init',
            attachment_type: 'default',
            actions: [
                {name: this.channelId, text: 'Add your truths & lies', type: 'button', value: 'yes'},
                {name: this.channelId, text: 'No thanks', type: 'button', value: 'no'},
            ],
        }];
        return this.web.chat.postMessage({channel: this.userId, text, attachments});
    }

    accept(payload, respond) {
        console.log(`User ${this.userId} wants to play 2TL on ${this.channelId}`);
        const dialog = {
            callback_id: 'accept',
            title: 'Submit truths and lie',
            state: this.channelId,
            elements: [
                {type: "textarea", label: "First truth", name: "truth1"},
                {type: "textarea", label: "Second truth", name: "truth2"},
                {type: "textarea", label: "Lie", name: "lie"},
            ],
        };
        this.web.dialog.open({trigger_id: payload.trigger_id, dialog});
        const msg = payload.original_message;
        msg.attachments[0].text = 'Awesome!';
        msg.attachments[0].actions = [];
        respond(msg);
    }

    decline(payload, respond) {
        console.log(`User ${this.userId} does not want to play 2TL on ${this.channelId}`);
        const msg = payload.original_message;
        msg.attachments[0].text = 'Ok, maybe next time!';
        msg.attachments[0].actions = [];
        respond(msg);
    }

    setChoices(payload, respond) {
        const choices = [
            payload.submission.truth1,
            payload.submission.truth2,
            payload.submission.lie,
        ];
        const errors = [];
        if (!payload.submission.truth1.trim())
            errors.push({name: 'truth1', error: 'First truth is required'});
        if (!payload.submission.truth2.trim())
            errors.push({name: 'truth2', error: 'Second truth is required'});
        if (!payload.submission.lie.trim())
            errors.push({name: 'lie', error: 'Your lie is required'});
        if (errors.length)
            return {errors};
        const perm = perm3();
        this.choices = [choices[perm[0]], choices[perm[1]], choices[perm[2]]];
        this.lie = perm.indexOf(2);
        console.log(`Recorded choices for ${this.userId}: ${this.choices}`);
        setTimeout(() => this.broadcastChoices(), 1);
        return null;
    }

    broadcastChoices() {
        const text = `Welcome <@${this.userId}> to the team!🎉`;
        const attachments = [{
            text: (`*Which do you think is <@${this.userId}>’s lie?*`
                   + '\n:one: ' + this.choices[0]
                   + '\n:two: ' + this.choices[1]
                   + '\n:three: ' + this.choices[2]),
            fallback: 'You’re unable to play 🙁',
            callback_id: 'guess',
            attachment_type: 'default',
            actions: [
                {name: `${this.channelId}/${this.userId}`, type: 'button', value: '0', text: '1'},
                {name: `${this.channelId}/${this.userId}`, type: 'button', value: '1', text: '2'},
                {name: `${this.channelId}/${this.userId}`, type: 'button', value: '2', text: '3'},
            ],
        }];
        setTimeout(() => this.revealAnswer(), revealTime);
        return this.web.chat.postMessage({channel: this.channelId, text, attachments})
            .then(r => this.broadcastTs = r.ts);
    }

    respondToChoice(payload) {
        const num = parseInt(payload.actions[0].value, 10);
        const text = this.lie === num
              ? `Yes! <@${this.userId}>'s lie is, “${this.choices[num]}”`
              : `No, <@${this.userId}> did not lie about “${this.choices[num]}”`;
        console.log(`${payload.user.id} thinks “${this.choices[num]}” is ${this.userId}'s lie in ${this.channelId}`);
        this.web.chat.postEphemeral({channel: this.channelId, text, user: payload.user.id});
    }

    revealAnswer() {
        const text = `Welcome <@${this.userId}> to the team!🎉`;
        const choices = this.choices.map((c, i) => i === this.lie ? `*${c}*` : c);
        const attachments = [{
            text: (`*<@${this.userId}>’s lie is ${this.lie + 1}*`
                   + '\n:one: ' + choices[0]
                   + '\n:two: ' + choices[1]
                   + '\n:three: ' + choices[2]),
            callback_id: 'revealed',
            attachment_type: 'default',
            actions: [],
        }];
        console.log(`Revealed answer for ${this.userId} on ${this.channelId}`);
        this.web.chat.update({channel: this.channelId, text, attachments, ts: this.broadcastTs});
    }
}

module.exports = Game;
