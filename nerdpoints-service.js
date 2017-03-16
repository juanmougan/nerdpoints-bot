'use strict';

let firebase = require('firebase');

let app = firebase.initializeApp({
	apiKey: process.env.FIREBASE_API_KEY,
	authDomain: process.env.FIREBASE_AUTH_DOMAIN,
	databaseURL: process.env.FIREBASE_DATABASE_URL,
	storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID
});

let root = app.database();
let ref = root.ref("users");


var get = (prettyPrint) => {
	return ref.once("value").then((data) => { return prettyPrint ? pretty(data) : null });
};

var createError = (code, msg, data) => {
	let error = new Error();
	error.code = code;
	error.message = msg;
	error.data = data;
	return error;
}

let add = (user, points, isAddition) => {
	return ref.child(user.id).once("value")
		.then((data) => {
			let userData = data.val();
			userData.points = isAddition ? parseInt(userData.points + points) : parseInt(userData.points - points);
			ref.child(user.id).update(userData);
			return get(true)
		})
};

var push = (user, points, isAddition) => {
	return root.ref("current").push({"user" : user, "points" : points, "isAddition" : isAddition})
};

var current = () => {
	return new Promise((res, rej) => {
	    root.ref("current").limitToFirst(1).once("child_added").then((data) => {
	        if(data.exists()) { res(data.val() )} else { rej(createError(1, "No hay votacion vigente", null))}
	    })

        .catch((err) => {
            rej(createError(1, "No hay votacion vigente", null))
        })
	});

}


var vote = (user, action) => {
   return root.ref("current").limitToFirst(1).once("value")
		.then((current) => {
			if(!current) {
				return createError(2, "current does not exists", null);
			}
			let firstKey = Object.keys(current.val())[0];
			let cur = current.val()[firstKey];
			if(!cur[action]) {
				cur[action] = {}; cur[action][user] = 1;
				return root.ref(`current/${firstKey}`).update(cur).then((data) => {return cur});
			} else if(cur[action][user]) {
				throw createError(1, "el usuario ya voto", cur);
			} else {
				return add(cur.user, cur.points, cur.isAddition)
					.then(() => {
						return root.ref(`current/${firstKey}`).remove();
					})

					.then(() => {
						cur.isRemoved = true;
						return cur;
					})

					.catch((err) => {
						throw err;
					})
			}
		})
};


var pretty = (persons) => {
	let users = [];
	persons.forEach((child) => { users.push(child.val()) })
	users.sort((a,b) => { return a["points"] > b["points"] ? -1 : (a["points"] < b["points"] ? 1 : 0) })
	let result = "";
	for(let user in users) {
		result += `${users[user].name} : *${users[user].points}*\n`;
	}
	return result;
};

module.exports = {
	add : add,
	get : get,
	current : current,
	push : push,
	vote : vote,
	APPROVE : "approve",
	DENY : "deny"
};
