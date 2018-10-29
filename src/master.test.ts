import 'should'
import * as sinon from 'sinon'
import { EventEmitter } from 'events'
import { TransportMessage } from 'ts-event-bus'
import * as os from 'os'

const intercept = require('intercept-require')

let PID = 0

class FakeProcess extends EventEmitter {
    public pid: number
    public send = sinon.stub()
    public stdout = new EventEmitter()
    public stderr = new EventEmitter()
    constructor() {
        super()
        this.pid = PID++
    }
}

const CHILD_PROCESS_STUB = {
    fork: sinon.stub(),
}

intercept(
    (moduleExport: {}, info: { moduleId: string }): {} =>
        info.moduleId === 'child_process' ? CHILD_PROCESS_STUB : moduleExport,
)

const getFakeRequests = (n: number): TransportMessage[] => {
    return [...Array(n).keys()].map(n => {
        return {
            type: 'request',
            slotName: 'bar',
            id: `${n}`,
            data: n,
        } as TransportMessage
    })
}

import { MasterNodeChannel } from '.'

describe('MasterNodeChannel', () => {
    let processes: FakeProcess[] = []

    beforeEach(() => {
        processes = []
        CHILD_PROCESS_STUB.fork.reset()
        const createProcess = () => {
            const fakeProcess = new FakeProcess()
            processes.push(fakeProcess)
            return fakeProcess
        }
        CHILD_PROCESS_STUB.fork.callsFake(createProcess)
    })

    it('should call fork with the correct options', () => {
        /* tslint:disable-next-line */
        new MasterNodeChannel({
            modulePath: 'foo',
            forkOptions: {
                cwd: './bar',
                env: {
                    baz: '1',
                },
            },
            args: ['--mode', 'qux'],
        })
        CHILD_PROCESS_STUB.fork.getCall(0).args.should.deepEqual([
            'foo',
            ['--mode', 'qux'],
            {
                cwd: './bar',
                env: {
                    baz: '1',
                },
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            },
        ])
    })

    it('should distribute task processing across the given number of nodes', () => {
        const n = 5
        const masterNode = new MasterNodeChannel({
            modulePath: 'foo',
            nodes: n,
        })
        getFakeRequests(n).forEach(m => masterNode.send(m))
        CHILD_PROCESS_STUB.fork.getCalls().length.should.eql(n)
    })

    it('should default to distributing the tasks across available CPUs if no number of nodes is given', () => {
        const numCpus = os.cpus().length
        const masterNode = new MasterNodeChannel({
            modulePath: 'foo',
        })
        getFakeRequests(numCpus * 4).forEach(m => masterNode.send(m))
        processes.length.should.eql(numCpus)
    })

    it('should process buffered messages as soon as a node becomes available', async () => {
        const masterNode = new MasterNodeChannel({
            modulePath: 'foo',
            nodes: 3,
        })
        const response = {
            type: 'response',
            id: 1,
            slotName: 'bar',
            data: 3,
        }
        const responseReceived = new Promise(resolve =>
            masterNode.onData(resolve),
        )
        getFakeRequests(4).forEach(m => masterNode.send(m))
        processes.every(p => p.send.calledOnce).should.be.True()
        processes[1].emit('message', response)
        processes[1].send.calledTwice.should.be.True()
        const received = await responseReceived
        received.should.eql(response)
    })

    const errorEvents: {
        eventName: string
        expectedMessage: string
        /* tslint:disable-next-line */
        args: string[]
    }[] = [
        {
            eventName: 'close',
            args: ['1', 'lorem'],
            expectedMessage: 'Node closed, code: 1, signal: lorem',
        },
        {
            eventName: 'error',
            args: ['ipsum'],
            expectedMessage: 'ipsum',
        },
        {
            eventName: 'disconnect',
            args: [],
            expectedMessage: 'Node disconnected',
        },
    ]

    errorEvents.forEach(({ eventName, expectedMessage, args }) => {
        it(`should send an error when the process of a node emits the '${eventName}' event`, async () => {
            const masterNode = new MasterNodeChannel({
                modulePath: 'foo',
            })
            const dataReceived = new Promise(resolve =>
                masterNode.onData(resolve),
            )
            const request: TransportMessage = {
                type: 'request',
                id: 'bar',
                slotName: 'baz',
                data: 5,
            }
            masterNode.send(request)
            processes.length.should.eql(1)
            processes[0].send.calledWith(request).should.be.True()
            processes[0].emit(eventName, ...args)
            const data = await dataReceived
            data.should.eql({
                type: 'error',
                slotName: 'baz',
                id: 'bar',
                message: expectedMessage,
            })
        })
    })
})
