'use strict';

let SlackBot = require('slackbots');
let nerdpoints = require("./nerdpoints-service");

const channelName = 'general';		// TODO this should be a variable

let bot = new SlackBot({
    token: process.env.SLACK_TOKEN,
    name: 'nerdometer'
});


let validPayload = (msg) => {
	if(msg.entities.length > 0 && msg.entities.find( (entity ) => { return entity.type == "text_mention" || entity.type == "mention" }) != undefined) {
		let user = msg.entities.find( (entity ) => { return entity.type == "text_mention" || entity.type == "mention" });
		user = user.user ? user.user : { id :  msg.text.substr(user.offset, user.length) };
		let pointsRaw = /[\+\-]?\d+/.exec(msg.text);
		if(pointsRaw) {
			let sign = /[\+\-]?/.exec(pointsRaw[0])[0];
			let points = parseInt(/\d+/.exec(pointsRaw[0])[0]) | 0;
            points = points > 100 ? 100 : points;
			return {"user" : user, "points" : points, "isAddition" : sign == "+" || sign == 0};
		} else {
			return undefined;
		}
	} else {
		return undefined;
	}
};

let userToString = (user) => {
    return user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : (user.first_name ? user.first_name : user.id);
};

let vote = (msg, action) => {
    nerdpoints.vote(msg.from.id, action)
        .then((data) => {
            if(data.isRemoved) {
                nerdpoints.get(true).then((list) => {
                    bot.postMessageToChannel(channelName, `Se *${action == nerdpoints.APPROVE ? "aprobó" : "denegó"}*! los *${data.points}* de *${userToString(data.user)}*\n\nLa lista quedó:\n${list}` , { parse_mode : "Markdown" });
                })
            } else {
                bot.postMessageToChannel(channelName, `${action == nerdpoints.APPROVE ? "Approved" : "Denied"}!!! *Falta 1 voto mas!!*`, {parse_mode : "Markdown"});
            }
        })

        .catch((err) => {
            if(err.code == 1) {
                bot.postMessageToChannel(channelName, `${userToString(msg.from)} ya votaste para los ${err.data.points} puntos de ${userToString(err.data.user)}. GATO!!!!`, { parse_mode : "Markdown" })
            } else if (err.code == 2) {
                bot.postMessageToChannel(channelName, `No te podes votar a vos ameeeeeeoooooo!!!`, { parse_mode : "Markdown" })
            } else {
                console.error(err);
                bot.postMessageToChannel(channelName, "Ups!! algo salio mal");
            }
        })
};

bot.onText(/\/nerdpoint (\@)*[\w\s]+ [\+\-]?\d+/, (msg, match) => {
	let data = validPayload(msg);
	if(data) {
	    nerdpoints.push(data.user, data.points, data.isAddition)
            .then((result) => {
                bot.postMessageToChannel(channelName, `Votacion para agregarle ${data.points} puntos a ${userToString(data.user)}`, { parse_mode : "Markdown" });
            })

            .catch((err) => {
                bot.postMessageToChannel(channelName, "Nope!");
            });

	} else {
		bot.postMessageToChannel(channelName, "Lo mandaste mal, tenes que mandar \"/nerdpoint @User (usando mention) +/-cantidad de puntos\". Por ejemplo : +10 o -10");
	}
});

bot.onText(/\/nerdpoints/, (msg, match) => {
	nerdpoints.get(true).then((data) => {
		bot.postMessageToChannel(channelName, data, { parse_mode : "Markdown" });
	});
});


bot.onText(/\/approve/, (msg, match) => {
    vote(msg, nerdpoints.APPROVE);
});

bot.onText(/\/deny/, (msg, match) => {
    vote(msg, nerdpoints.DENY)
});

bot.onText(/\/current/, (msg, match) => {
    nerdpoints.currents(true)
        .then((data) => {
            let text = "";
            data.forEach((item, index) => {
                let approves = item.value.approve ? 1 : 0;
                let deny = item.value.deny ? 1 : 0;
                text += `${index + 1} - ${userToString(item.value.user)} *${item.value.isAddition ? "+" : "-"}${item.value.points}* A : *${approves}* D: *${deny}* ${index == 0 ? "* <= Actual*" : ""}\n`
            });
            bot.postMessageToChannel(channelName, text, {parse_mode : "Markdown"});
        })

        .catch((err) => {
            console.error(err);
            if(err.code == 1) {
                bot.postMessageToChannel(channelName, "No hay votación vigente, manda nerdpoint para agregar una votación nueva mulo!!!");
            } else {
                bot.postMessageToChannel(channelName, "Ups!! algo salio mal");
            }
        })
});
