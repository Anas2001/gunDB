const Gun = require("gun");
const {SEA} = Gun;
const {Subject} = require("rxjs");
const MessageType = require("./api/MessageType");

const auth = (gunDB , authPair = {}) => new Promise((resolve, reject) => gunDB.user().auth(authPair, res => res.err ? reject(res.err) : resolve({gunDB, authPair})))

const put = (gunDB, path = "key1.key2.key3", data, cert, pub) => new Promise((resolve, reject) => {
    let node = path
        .split(".")
        .reduce((acc, key) => acc.get(key), gunDB);
    node = pub ? node.get(pub) : node;
    return node.put(data, res => res.err ? reject(res.err) : resolve({res, data: data}), cert ? { opt: { cert } } : undefined);
});


const read = (gunDB, path = "key1.key2.key3") => path
    .split(".").reduce((acc, key) => acc.get(key), gunDB)
    .then();

const INBOX = "INBOX";

module.exports = class GunService {
    constructor(authPair = {pub: "", epub: "", priv: "", epriv: ""}, nameSpace, peers, file = "./test-data") {
        this.authPair = authPair;
        this.peers = peers;
        this.gunDB = Gun({peers, file, localStorage: true});
        require("gun/axe");
        this.nameSpace = nameSpace;
        this.user = this.gunDB.user();
        this.shardSpace = INBOX;
    }

    getRoomAuthPairPath(id) {
        return `${this.nameSpace}.pairs.${id}`;
    }

    getRoomPubPath(id) {
        return `${this.nameSpace}.pubs.${id}`;
    }

    getRoomCertPathOfUser(id, pub) {
        return `${this.nameSpace}.certs.${id}.${pub}`;
    }

    getRoomNamePath(id) {
        return `${this.nameSpace}.names.${id}`;
    }

    async auth() {
        return auth(this.gunDB, this.authPair)
            .then(res => Promise.resolve(this.user = this.gunDB.user()).then(_ => res));
    }

    async createRoom(id, name) {
        return this
            .auth()
            .then(() => SEA.pair())
            .then(room => put(this.user, this.getRoomPubPath(id), room.pub).then(_ => room)) // save pub key of room
            .then(room => SEA.encrypt(room, this.authPair))// encrypt the room pair
            .then(encRoom => put(this.user, this.getRoomAuthPairPath(id), encRoom)) // save encrypted pair in this user path
            .then(_ => put(this.user, this.getRoomNamePath(id), name)) // save room name
    }

    async getRoomPubById(roomId, userPub) {
        return read(Gun({peers: this.peers}).user(userPub), this.getRoomPubPath(roomId));
    }

    async grantWriteAccess(roomId, userPub, startWith, expire) {
        return this
            .auth()
            .then(() => read(this.user, this.getRoomAuthPairPath(roomId))) // get encrypted pair in this user path
            .then(encRoom => SEA.decrypt(encRoom, this.authPair)) // decrypt the pair
            .then(roomAuthPair => auth(Gun({peers: this.peers}), roomAuthPair)) // auth to room with decrypted pair
            .then(async ({gunDB, authPair}) =>
                SEA
                    .certify(userPub, { "*": startWith, "+": "*" }, authPair, null, expire ? {expiry: Gun.state() + expire} : {})
                    .then(cert => put(gunDB.user(), this.getRoomCertPathOfUser(roomId, userPub), cert))
            ) // create cert
    }

    async getRoomCert(roomId, roomPub) {
        return read(Gun({peers: this.peers}).user(roomPub), this.getRoomCertPathOfUser(roomId, this.authPair.pub));
    }

    async writeInRoom(roomId, ownerPub, path, data) {
        return this
            .auth()
            .then(_ => this.getRoomPubById(roomId, ownerPub))
            .then(roomPub => this.getRoomCert(roomId, roomPub).then(cert => ({cert, roomPub})))
            .then(({cert, roomPub}) => put(this.user.user(roomPub), path, data, cert, this.authPair.pub))
    }

    async writeInPath(path, data) {
        return this
            .auth()
            .then(_ => put(this.user, path, data));
    }

    async createPrivateMessage(toUserEPub, userPub, message, space = "messages") {
        SEA
            .secret(toUserEPub, this.authPair)
            .then(privateKey => SEA.encrypt(message, privateKey))
            .then(secretMessage => this.sendImmutableMessage(space, secretMessage, userPub));
    }

    sendImmutableMessage(space, message, userPub) {
        return new Promise((resolve, reject) => {
            this.user.get(space).set(message).on(async (data, key) => {
                try {
                    const hash = await SEA.work(key, null, null, {name: 'SHA-256'});
                    this.gunDB.get("#" + space).get(userPub + "#" + hash).put(key, res => res.err ? reject(res.err) : resolve(res));
                } catch (e) {
                    reject(e);
                }
            })
        });
    }

    async grantWritePart(userPub, spaceName) {
        return SEA
            .certify(userPub, ["^" + spaceName + ".*"], this.authPair)
            .then(cert => this.sendImmutableMessage(this.shardSpace, {cert, type: MessageType.OPEN_SPACE_CERT}, userPub));
    }

    $path(path, userPub) {
        const subject = new Subject();
        let node = path
            .split(".")
            .reduce((acc, key) => acc.get(key), this.gunDB);
        node = userPub ? node.get(userPub) : node;
        node.map().once(subject.next);
        return subject;
    }

    $receivePrivateMessages(space) {
        const subject = new Subject();
        this.gunDB
            .get("#" + space)
            .get({ "." : { "*": this.authPair.pub } })
            .map()
            .once(data => this.gunDB.user(this.authPair.pub).get(space).get(data).once(msg => subject.next(msg)));
        return subject;
    }

};