# [ts-event-bus](https://github.com/Dashlane/ts-event-bus) Cluster Channel

A [ts-event-bus](https://github.com/Dashlane/ts-event-bus) channel for distributing computation over multiple Node.js processes. Uses `child_process.fork()` with `ipc` enabled.

This module exports two channels: `MasterNodeChannel` and `ChildNodeChannel`. Events triggered from the master node are processed as follows:

- The event is sent to any available child node
- If no node is available and the maximum number of nodes has not been reached, a new child node is created
- If all nodes are busy and the maximum number of nodes has been reached, the event is buffered, and processed as soon as a node is available

## Example Usage

This example assumes the following module layout:

```
/
    master.ts
    child.ts
    events.ts
```

### Events

`events.ts` is a standard ts-event-bus `EventDeclaration`. In this example, it declares a single event, `foo`

```
import { EventDeclaration, slot } from ts-event-bus

export default {
    foo: slot<{ bar: number }, { baz: number }>()
} as EventDeclaration
```

### Master Node

In master.ts, instanciate a `MasterNodeChannel` and an event bus using this channel:

```
import events from './events.ts'
import { createEventBus } from 'ts-event-bus'
import { MasterNodeChannel } from 'ts-event-bus-cluster-channel'

const channel = new MasterNodeChannel({
    moduleName: './child.ts',
    nodes: 5 // Optional, defaults to `os.cpus().length`,
    args: [], // Optional, any command line arguments that will be passed on to child_process.fork()
    forkOptions: {} // Optional, any options to be passed to child_process.fork()
})

const childNodes = createEventBus({
    events,
    channels: [ channel ]
})
```

Calls to `childNodes.foo()` will be distributed across at most 5 child nodes as needed.

### Child node

In `child.ts`, instanciate an event bus using a `ChildNodeChannel`:

```
import events from './events.ts'
import { ChildNodeChannel } from 'ts-event-bus-cluster-channel'

const master = createEventBus({
    events,
    channels: [ new ChildNodeChannel() ]
})

master.foo.on(({bar}) => {
    // do something with event data
})
```

To test the child node in isolation, you may want to use dependency injection instead of instanciating the event bus by default:

```
const withMasterNode = (master typeof events) => {

    master.foo.on(() => {
        // do something with event data
    })
}

export default withMasterNode

if (require.main === module) {
    const masterNode = createEventBus({
        events,
        channels: [ new ChildNodeChannel() ]
    })
    withMasterNode(masterNode)
}
```

This would allow for the following test code:

```
import withMasterNode from './../src/child'
import events from './../src/events'

describe('child node', () => {

    const childNode = createEventBus({ events })
    withMasterNode(eventBus)

    it('should correctly process foo()', async () => {
        const bar = await childNode.foo()
        bar.baz.should.be.True()
    })

})
```
