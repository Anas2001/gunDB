//Alice-Program-File:

const GunService = require("gun-carb");
const config = require("../config");
(async () => {
    const gunService = new GunService(config.alice, config.nameSpace, config.peers, config.file);
    await gunService.createPrivateMessage(config.bob.epub, config.bob.pub, "yes true", "veryImportant");

    gunService.$receiveDecryptedPrivateMessages("veryImportant").subscribe(console.log)
})();


//Bob-Program-File:

const GunService = require("gun-carb");
const config = require("../config");
(async () => {
    const gunService = new GunService(config.bob, config.nameSpace, config.peers, config.file);

    gunService.$receiveDecryptedPrivateMessages("veryImportant").subscribe(res => gunService.createPrivateMessage(config.alice.epub, config.alice.pub, "pong", "veryImportant").then(_ => console.log(res)));
})();

//Config-File:

module.exports = {
    peers: ["http://localhost:8760/gun", "http://localhost:8761/gun", "http://localhost:8762/gun"],
    file: "./db",
    nameSpace: "chat-rooms_2022",
    roomId: "12345678913",
    userSpace: "hotel",
    alice: {
        pub: 'sXyCAUe_wW4MtqkClZIeVUOu41H6aqglJpxFLGC0WTk.1JYX4d2lx35P_Bzv43-ypiqduONHiUx9tNcq_Fuzv2w',
        priv: 'L7RkxWA8XFCf-TffBp6uz0JZZX5kBVJoZ2NeWYhcSCM',
        epub: '2SQ1nOCpS8tnWmdjCXzcZjfBC876ZxPNLkPy9qh6-v0.xYw_hwCFo09AIYM3EQ1z1z0fUYI_y_ofei4J8uAK4fw',
        epriv: '1tQ6GHcldVYmltU31Q_VPZPMUNdTTDIlqh69Kclt_wA'
    },
    bob: {
        pub: 'OdVckyQgm2hB1e9IwRgYobvpHYqTlzk2ygyWI_aEwAM.F8tCuQVJXxnxKVcUms6iJNBGDGVq5R80KrmnpI5ZnX4',
        priv: '6uQq8qti11axNuNmBxzT0c-hnNslHBl_lTmzb7Fv7G0',
        epub: 'YH8C0IfwyAeDuZs2fBc3qkpY3DVPRBzuL_SSZeb6Zu8.dVtvZPTF6YIL1EHMTWme0z9O7fwNdNR3Ip4BSlxNtn4',
        epriv: 'PBd23-rqCsZRPmwg3tadhEJwja0zi8BrTEGxcqVY4Uw'
    }
};
