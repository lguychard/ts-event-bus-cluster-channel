import * as child_process from 'child_process'
import { GenericChannel, TransportMessage } from 'ts-event-bus'
import * as os from 'os'

const NUM_CPUS = os.cpus().length

export interface MasterNodeOptions {
    modulePath: string
    args?: string[]
    forkOptions?: child_process.ForkOptions
    nodes?: number
}

interface WorkerNode {
    worker: child_process.ChildProcess
    currentMessage: TransportMessage | null
    busy: boolean
}

function runOn(node: WorkerNode, message: TransportMessage): void {
    node.busy = true
    node.currentMessage = message
    node.worker.send(message)
}

export class MasterNodeChannel extends GenericChannel {
    private readonly _nodes: { [id: number]: WorkerNode } = {}
    private readonly _fork: () => child_process.ChildProcess
    private _maxNodes: number = NUM_CPUS
    private _buffered: TransportMessage[] = []

    constructor({ modulePath, args, forkOptions, nodes }: MasterNodeOptions) {
        super()

        // overwrite forkOptions.stdio to enable ipc
        const opts: child_process.ForkOptions = forkOptions || {}
        opts.stdio = ['pipe', 'pipe', 'pipe', 'ipc']

        // Capture provided fork params
        this._fork = () => child_process.fork(modulePath, args, opts)

        // Set max number of nodes if provided
        if (nodes) {
            this._maxNodes = nodes
        }

        this._connected()
        this._createNode()
    }

    send(message: TransportMessage) {
        let availableNode: WorkerNode | null = null

        // Check if any preexisting nodes are available
        for (let id in this._nodes) {
            if (!this._nodes.hasOwnProperty[id]) {
                continue
            }
            const node = this._nodes[id]
            if (!this._nodes[id].busy) {
                availableNode = node
                break
            }
        }

        if (availableNode) {
            runOn(availableNode, message)
        } else if (this._canCreateNode()) {
            runOn(this._createNode(), message)
        } else {
            this._buffered.push(message)
        }
    }

    private _canCreateNode(): boolean {
        return Object.keys(this._nodes).length !== this._maxNodes
    }

    private _createNode(): WorkerNode {
        const subprocess = this._fork()
        const id = subprocess

        subprocess.stdout.on('data', bufToStr(console.log))
        subprocess.stderr.on('data', bufToStr(console.error))

        const newNode: WorkerNode = {
            worker: subprocess,
            busy: false,
            currentMessage: null,
        }
        this._nodes[subprocess.pid] = newNode

        subprocess.on('message', message => {
            this._messageReceived(message)
            newNode.currentMessage = null
            if (this._buffered.length) {
                runOn(newNode, this._buffered.shift() as TransportMessage)
            } else {
                this._nodes[subprocess.pid].busy = false
            }
        })

        const killNode = (err: string) => {
            delete this._nodes[subprocess.pid]
            if (newNode.currentMessage === null) {
                return
            }
            const message = newNode.currentMessage
            if (message.type === 'request') {
                this._messageReceived({
                    type: 'error',
                    id: message.id,
                    slotName: message.slotName,
                    message: err || 'unknown error',
                })
            }
        }

        subprocess.once('close', (code, signal) => killNode(`Node closed, code: ${code}, signal: ${signal}`))
        subprocess.once('disconnect', () => killNode('Node disconnected'))
        subprocess.once('error', killNode)

        return newNode
    }
}

function bufToStr<T>(f: (s: string) => T): (m: Buffer | {}) => T {
    return m => f(m.toString())
}
