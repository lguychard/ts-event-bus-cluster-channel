import { GenericChannel } from 'ts-event-bus'

export class ChildNodeChannel extends GenericChannel {
    constructor() {
        super()
        process.on('message', message => {
            this._messageReceived(message)
        })
        this._connected()
    }

    send(message: {}) {
        if (!process.send) {
            throw new Error('ipc not enabled')
        } else {
            process.send(message)
        }
    }
}
