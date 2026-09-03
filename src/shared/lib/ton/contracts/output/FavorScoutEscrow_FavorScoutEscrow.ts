import {
    Cell,
    Slice,
    Address,
    Builder,
    beginCell,
    ComputeError,
    TupleItem,
    TupleReader,
    Dictionary,
    contractAddress,
    address,
    ContractProvider,
    Sender,
    Contract,
    ContractABI,
    ABIType,
    ABIGetter,
    ABIReceiver,
    TupleBuilder,
    DictionaryValue
} from '@ton/core';

export type DataSize = {
    $$type: 'DataSize';
    cells: bigint;
    bits: bigint;
    refs: bigint;
}

export function storeDataSize(src: DataSize) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.cells, 257);
        b_0.storeInt(src.bits, 257);
        b_0.storeInt(src.refs, 257);
    };
}

export function loadDataSize(slice: Slice) {
    const sc_0 = slice;
    const _cells = sc_0.loadIntBig(257);
    const _bits = sc_0.loadIntBig(257);
    const _refs = sc_0.loadIntBig(257);
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadGetterTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function storeTupleDataSize(source: DataSize) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.cells);
    builder.writeNumber(source.bits);
    builder.writeNumber(source.refs);
    return builder.build();
}

export function dictValueParserDataSize(): DictionaryValue<DataSize> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDataSize(src)).endCell());
        },
        parse: (src) => {
            return loadDataSize(src.loadRef().beginParse());
        }
    }
}

export type SignedBundle = {
    $$type: 'SignedBundle';
    signature: Buffer;
    signedData: Slice;
}

export function storeSignedBundle(src: SignedBundle) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBuffer(src.signature);
        b_0.storeBuilder(src.signedData.asBuilder());
    };
}

export function loadSignedBundle(slice: Slice) {
    const sc_0 = slice;
    const _signature = sc_0.loadBuffer(64);
    const _signedData = sc_0;
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadGetterTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function storeTupleSignedBundle(source: SignedBundle) {
    const builder = new TupleBuilder();
    builder.writeBuffer(source.signature);
    builder.writeSlice(source.signedData.asCell());
    return builder.build();
}

export function dictValueParserSignedBundle(): DictionaryValue<SignedBundle> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSignedBundle(src)).endCell());
        },
        parse: (src) => {
            return loadSignedBundle(src.loadRef().beginParse());
        }
    }
}

export type StateInit = {
    $$type: 'StateInit';
    code: Cell;
    data: Cell;
}

export function storeStateInit(src: StateInit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeRef(src.code);
        b_0.storeRef(src.data);
    };
}

export function loadStateInit(slice: Slice) {
    const sc_0 = slice;
    const _code = sc_0.loadRef();
    const _data = sc_0.loadRef();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadGetterTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function storeTupleStateInit(source: StateInit) {
    const builder = new TupleBuilder();
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    return builder.build();
}

export function dictValueParserStateInit(): DictionaryValue<StateInit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStateInit(src)).endCell());
        },
        parse: (src) => {
            return loadStateInit(src.loadRef().beginParse());
        }
    }
}

export type Context = {
    $$type: 'Context';
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
}

export function storeContext(src: Context) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.bounceable);
        b_0.storeAddress(src.sender);
        b_0.storeInt(src.value, 257);
        b_0.storeRef(src.raw.asCell());
    };
}

export function loadContext(slice: Slice) {
    const sc_0 = slice;
    const _bounceable = sc_0.loadBit();
    const _sender = sc_0.loadAddress();
    const _value = sc_0.loadIntBig(257);
    const _raw = sc_0.loadRef().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadGetterTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function storeTupleContext(source: Context) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.bounceable);
    builder.writeAddress(source.sender);
    builder.writeNumber(source.value);
    builder.writeSlice(source.raw.asCell());
    return builder.build();
}

export function dictValueParserContext(): DictionaryValue<Context> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeContext(src)).endCell());
        },
        parse: (src) => {
            return loadContext(src.loadRef().beginParse());
        }
    }
}

export type SendParameters = {
    $$type: 'SendParameters';
    mode: bigint;
    body: Cell | null;
    code: Cell | null;
    data: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeSendParameters(src: SendParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        if (src.code !== null && src.code !== undefined) { b_0.storeBit(true).storeRef(src.code); } else { b_0.storeBit(false); }
        if (src.data !== null && src.data !== undefined) { b_0.storeBit(true).storeRef(src.data); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadSendParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _code = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _data = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleSendParameters(source: SendParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserSendParameters(): DictionaryValue<SendParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSendParameters(src)).endCell());
        },
        parse: (src) => {
            return loadSendParameters(src.loadRef().beginParse());
        }
    }
}

export type MessageParameters = {
    $$type: 'MessageParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeMessageParameters(src: MessageParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadMessageParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleMessageParameters(source: MessageParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserMessageParameters(): DictionaryValue<MessageParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMessageParameters(src)).endCell());
        },
        parse: (src) => {
            return loadMessageParameters(src.loadRef().beginParse());
        }
    }
}

export type DeployParameters = {
    $$type: 'DeployParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    bounce: boolean;
    init: StateInit;
}

export function storeDeployParameters(src: DeployParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeBit(src.bounce);
        b_0.store(storeStateInit(src.init));
    };
}

export function loadDeployParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _bounce = sc_0.loadBit();
    const _init = loadStateInit(sc_0);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadGetterTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadGetterTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function storeTupleDeployParameters(source: DeployParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeBoolean(source.bounce);
    builder.writeTuple(storeTupleStateInit(source.init));
    return builder.build();
}

export function dictValueParserDeployParameters(): DictionaryValue<DeployParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployParameters(src)).endCell());
        },
        parse: (src) => {
            return loadDeployParameters(src.loadRef().beginParse());
        }
    }
}

export type StdAddress = {
    $$type: 'StdAddress';
    workchain: bigint;
    address: bigint;
}

export function storeStdAddress(src: StdAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 8);
        b_0.storeUint(src.address, 256);
    };
}

export function loadStdAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(8);
    const _address = sc_0.loadUintBig(256);
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleStdAddress(source: StdAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeNumber(source.address);
    return builder.build();
}

export function dictValueParserStdAddress(): DictionaryValue<StdAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStdAddress(src)).endCell());
        },
        parse: (src) => {
            return loadStdAddress(src.loadRef().beginParse());
        }
    }
}

export type VarAddress = {
    $$type: 'VarAddress';
    workchain: bigint;
    address: Slice;
}

export function storeVarAddress(src: VarAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 32);
        b_0.storeRef(src.address.asCell());
    };
}

export function loadVarAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(32);
    const _address = sc_0.loadRef().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleVarAddress(source: VarAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeSlice(source.address.asCell());
    return builder.build();
}

export function dictValueParserVarAddress(): DictionaryValue<VarAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVarAddress(src)).endCell());
        },
        parse: (src) => {
            return loadVarAddress(src.loadRef().beginParse());
        }
    }
}

export type BasechainAddress = {
    $$type: 'BasechainAddress';
    hash: bigint | null;
}

export function storeBasechainAddress(src: BasechainAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        if (src.hash !== null && src.hash !== undefined) { b_0.storeBit(true).storeInt(src.hash, 257); } else { b_0.storeBit(false); }
    };
}

export function loadBasechainAddress(slice: Slice) {
    const sc_0 = slice;
    const _hash = sc_0.loadBit() ? sc_0.loadIntBig(257) : null;
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadGetterTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function storeTupleBasechainAddress(source: BasechainAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.hash);
    return builder.build();
}

export function dictValueParserBasechainAddress(): DictionaryValue<BasechainAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBasechainAddress(src)).endCell());
        },
        parse: (src) => {
            return loadBasechainAddress(src.loadRef().beginParse());
        }
    }
}

export type Deploy = {
    $$type: 'Deploy';
    queryId: bigint;
}

export function storeDeploy(src: Deploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2490013878, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2490013878) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadGetterTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function storeTupleDeploy(source: Deploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeploy(): DictionaryValue<Deploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadDeploy(src.loadRef().beginParse());
        }
    }
}

export type DeployOk = {
    $$type: 'DeployOk';
    queryId: bigint;
}

export function storeDeployOk(src: DeployOk) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2952335191, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeployOk(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2952335191) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadGetterTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function storeTupleDeployOk(source: DeployOk) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeployOk(): DictionaryValue<DeployOk> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployOk(src)).endCell());
        },
        parse: (src) => {
            return loadDeployOk(src.loadRef().beginParse());
        }
    }
}

export type FactoryDeploy = {
    $$type: 'FactoryDeploy';
    queryId: bigint;
    cashback: Address;
}

export function storeFactoryDeploy(src: FactoryDeploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1829761339, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.cashback);
    };
}

export function loadFactoryDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1829761339) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _cashback = sc_0.loadAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadGetterTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function storeTupleFactoryDeploy(source: FactoryDeploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.cashback);
    return builder.build();
}

export function dictValueParserFactoryDeploy(): DictionaryValue<FactoryDeploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFactoryDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadFactoryDeploy(src.loadRef().beginParse());
        }
    }
}

export type ResolveScoutDispute = {
    $$type: 'ResolveScoutDispute';
    freelancerPercent: bigint;
}

export function storeResolveScoutDispute(src: ResolveScoutDispute) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(450855303, 32);
        b_0.storeUint(src.freelancerPercent, 8);
    };
}

export function loadResolveScoutDispute(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 450855303) { throw Error('Invalid prefix'); }
    const _freelancerPercent = sc_0.loadUintBig(8);
    return { $$type: 'ResolveScoutDispute' as const, freelancerPercent: _freelancerPercent };
}

export function loadTupleResolveScoutDispute(source: TupleReader) {
    const _freelancerPercent = source.readBigNumber();
    return { $$type: 'ResolveScoutDispute' as const, freelancerPercent: _freelancerPercent };
}

export function loadGetterTupleResolveScoutDispute(source: TupleReader) {
    const _freelancerPercent = source.readBigNumber();
    return { $$type: 'ResolveScoutDispute' as const, freelancerPercent: _freelancerPercent };
}

export function storeTupleResolveScoutDispute(source: ResolveScoutDispute) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.freelancerPercent);
    return builder.build();
}

export function dictValueParserResolveScoutDispute(): DictionaryValue<ResolveScoutDispute> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeResolveScoutDispute(src)).endCell());
        },
        parse: (src) => {
            return loadResolveScoutDispute(src.loadRef().beginParse());
        }
    }
}

export type FavorScoutEscrow$Data = {
    $$type: 'FavorScoutEscrow$Data';
    platform: Address;
    customer: Address;
    freelancer: Address;
    scout: Address;
    dealId: bigint;
    scoutCommissionSharePercent: bigint;
    deadlineDurationSeconds: bigint;
    amount: bigint;
    status: bigint;
    deadlineAt: bigint;
}

export function storeFavorScoutEscrow$Data(src: FavorScoutEscrow$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.platform);
        b_0.storeAddress(src.customer);
        b_0.storeAddress(src.freelancer);
        const b_1 = new Builder();
        b_1.storeAddress(src.scout);
        b_1.storeUint(src.dealId, 64);
        b_1.storeUint(src.scoutCommissionSharePercent, 8);
        b_1.storeUint(src.deadlineDurationSeconds, 32);
        b_1.storeCoins(src.amount);
        b_1.storeUint(src.status, 8);
        b_1.storeUint(src.deadlineAt, 64);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadFavorScoutEscrow$Data(slice: Slice) {
    const sc_0 = slice;
    const _platform = sc_0.loadAddress();
    const _customer = sc_0.loadAddress();
    const _freelancer = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _scout = sc_1.loadAddress();
    const _dealId = sc_1.loadUintBig(64);
    const _scoutCommissionSharePercent = sc_1.loadUintBig(8);
    const _deadlineDurationSeconds = sc_1.loadUintBig(32);
    const _amount = sc_1.loadCoins();
    const _status = sc_1.loadUintBig(8);
    const _deadlineAt = sc_1.loadUintBig(64);
    return { $$type: 'FavorScoutEscrow$Data' as const, platform: _platform, customer: _customer, freelancer: _freelancer, scout: _scout, dealId: _dealId, scoutCommissionSharePercent: _scoutCommissionSharePercent, deadlineDurationSeconds: _deadlineDurationSeconds, amount: _amount, status: _status, deadlineAt: _deadlineAt };
}

export function loadTupleFavorScoutEscrow$Data(source: TupleReader) {
    const _platform = source.readAddress();
    const _customer = source.readAddress();
    const _freelancer = source.readAddress();
    const _scout = source.readAddress();
    const _dealId = source.readBigNumber();
    const _scoutCommissionSharePercent = source.readBigNumber();
    const _deadlineDurationSeconds = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _status = source.readBigNumber();
    const _deadlineAt = source.readBigNumber();
    return { $$type: 'FavorScoutEscrow$Data' as const, platform: _platform, customer: _customer, freelancer: _freelancer, scout: _scout, dealId: _dealId, scoutCommissionSharePercent: _scoutCommissionSharePercent, deadlineDurationSeconds: _deadlineDurationSeconds, amount: _amount, status: _status, deadlineAt: _deadlineAt };
}

export function loadGetterTupleFavorScoutEscrow$Data(source: TupleReader) {
    const _platform = source.readAddress();
    const _customer = source.readAddress();
    const _freelancer = source.readAddress();
    const _scout = source.readAddress();
    const _dealId = source.readBigNumber();
    const _scoutCommissionSharePercent = source.readBigNumber();
    const _deadlineDurationSeconds = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _status = source.readBigNumber();
    const _deadlineAt = source.readBigNumber();
    return { $$type: 'FavorScoutEscrow$Data' as const, platform: _platform, customer: _customer, freelancer: _freelancer, scout: _scout, dealId: _dealId, scoutCommissionSharePercent: _scoutCommissionSharePercent, deadlineDurationSeconds: _deadlineDurationSeconds, amount: _amount, status: _status, deadlineAt: _deadlineAt };
}

export function storeTupleFavorScoutEscrow$Data(source: FavorScoutEscrow$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.platform);
    builder.writeAddress(source.customer);
    builder.writeAddress(source.freelancer);
    builder.writeAddress(source.scout);
    builder.writeNumber(source.dealId);
    builder.writeNumber(source.scoutCommissionSharePercent);
    builder.writeNumber(source.deadlineDurationSeconds);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.status);
    builder.writeNumber(source.deadlineAt);
    return builder.build();
}

export function dictValueParserFavorScoutEscrow$Data(): DictionaryValue<FavorScoutEscrow$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFavorScoutEscrow$Data(src)).endCell());
        },
        parse: (src) => {
            return loadFavorScoutEscrow$Data(src.loadRef().beginParse());
        }
    }
}

 type FavorScoutEscrow_init_args = {
    $$type: 'FavorScoutEscrow_init_args';
    platform: Address;
    customer: Address;
    freelancer: Address;
    scout: Address;
    dealId: bigint;
    expectedAmount: bigint;
    scoutCommissionSharePercent: bigint;
    deadlineDurationSeconds: bigint;
}

function initFavorScoutEscrow_init_args(src: FavorScoutEscrow_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.platform);
        b_0.storeAddress(src.customer);
        b_0.storeAddress(src.freelancer);
        const b_1 = new Builder();
        b_1.storeAddress(src.scout);
        b_1.storeInt(src.dealId, 257);
        b_1.storeInt(src.expectedAmount, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.scoutCommissionSharePercent, 257);
        b_2.storeInt(src.deadlineDurationSeconds, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

async function FavorScoutEscrow_init(platform: Address, customer: Address, freelancer: Address, scout: Address, dealId: bigint, expectedAmount: bigint, scoutCommissionSharePercent: bigint, deadlineDurationSeconds: bigint) {
    const __code = Cell.fromHex('b5ee9c7241022c01000a3c000262ff008e88f4a413f4bcf2c80bed53208e9c30eda2edfb01d072d721d200d200fa4021103450666f04f86102f862e1ed43d9010f0202710207020162030501ebb24f3b513434800063883e903e903e903500743e9034cff4c1f4c7fe8034c1f4cfcc041e841e441e1b06a3913e903e903e903500743e9020404075c020404075c0350c3420404075c020404075c00c04160415c41582345541a0576708f0803cbd208039a18870803cbd1c08040d0408f8b6cf1b28600400022601ebb1c4fb513434800063883e903e903e903500743e9034cff4c1f4c7fe8034c1f4cfcc041e841e441e1b06a3913e903e903e903500743e9020404075c020404075c0350c3420404075c020404075c00c04160415c41582345541a0576708f0803cbd208039a18870803cbd1c08040d0408f8b6cf1b286006000224020120080d020120090b01ebb5a15da89a1a400031c41f481f481f481a803a1f481a67fa60fa63ff401a60fa67e6020f420f220f0d8351c89f481f481f481a803a1f481020203ae01020203ae01a861a1020203ae01020203ae006020b020ae20ac11a2aa0d02bb38478401e5e90401cd0c438401e5e8e04020682047c5b678d94300a00022101ebb7fb5da89a1a400031c41f481f481f481a803a1f481a67fa60fa63ff401a60fa67e6020f420f220f0d8351c89f481f481f481a803a1f481020203ae01020203ae01a861a1020203ae01020203ae006020b020ae20ac11a2aa0d02bb38478401e5e90401cd0c438401e5e8e04020682047c5b678d94300c00022001ebb906aed44d0d200018e20fa40fa40fa40d401d0fa40d33fd307d31ffa00d307d33f30107a107910786c1a8e44fa40fa40fa40d401d0fa40810101d700810101d700d430d0810101d700810101d7003010581057105608d15506815d9c23c200f2f48200e68621c200f2f4702010341023e2db3c6ca180e0004f82802fced44d0d200018e20fa40fa40fa40d401d0fa40d33fd307d31ffa00d307d33f30107a107910786c1a8e44fa40fa40fa40d401d0fa40810101d700810101d700d430d0810101d700810101d7003010581057105608d15506815d9c23c200f2f48200e68621c200f2f4702010341023e20b925f0be0702ad74920c21fe3000110170232310ad31f2182101adf8187bae302218210946a98b6bae3020b111604f6313a09d30730f8416f245b8200df8d322ac705f2f48200b0e40ac0031af2f4811a4229c165f2f420720aa88064a9045ca120c2008ebd7071882b5530146d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb009130e220c200e30f121314150058000000004661766f722053636f757420457363726f773a204469737075746520726566756e642073706c6974017e8d0a11985d9bdc8814d8dbdd5d08115cd8dc9bddce88111a5cdc1d5d19481c185e5bdd5d081cdc1b1a5d20109b108a1079106810571046103510241023db3c1a010e3010795516db3c220050c87f01ca005590509ace17ce15ce03c8ce12cb3fcb0712cb1f58fa0212cb0712cb3fcdc9ed54db3100dc313a09d33f30c8018210aff90f5758cb1fcb3fc9108a10791068105710461035443012f84270705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00c87f01ca005590509ace17ce15ce03c8ce12cb3fcb0712cb1f58fa0212cb0712cb3fcdc9ed54db3101e4c00001c121b08e653939f8416f24303282008b9b0ac0001af2f481554b5197c70519f2f482008cd929820afaf080a019be18f2f471f82328a01079106810571046103510241023c87f01ca005590509ace17ce15ce03c8ce12cb3fcb0712cb1f58fa0212cb0712cb3fcdc9ed54e009f901201803ea82f0f29fa7e2b166aa5aa95ed61d3477f8d1ef25469d0a1be9360a76bf7b423bc151bae3022082f02282abf8277dc4ff9183255e3d0fb487fa3963bcea406ca8943205a96e5346cdbae30282f0054e0a8595d08326d56c73cd5dca85c1e629fe1e418a935a3b82b7e558803707bae3025f0af2c08219242902be30f8416f2410235f038200a5c35318c70592317f945119c705e2f2f4820082b329c00192397f9309c003e219f2f4728d0691985d9bdc8814d8dbdd5d08115cd8dc9bddce8814185e5bdd5d20108a107910682710681057104610354300db3c1a2b04d421a7058064a9045307a88064a9045ca15042a120c2008ec0707104db3c2d045055146d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00923031e221c2009131e30d20c2009130e30d1b1d1f210142c87001cb1f6f00016f8c6d6f8c01db3c6f2201c993216eb396016f2259ccc9e8311c00b620d74a21d7499720c20022c200b18e48036f22807f22cf31ab02a105ab025155b60820c2009a20aa0215d71803ce4014de596f025341a1c20099c8016f025044a1aa028e123133c20099d430d020d74a21d749927020e2e2e85f03017e7071882b04055520146d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb001e0050000000004661766f722053636f757420457363726f773a2053636f757420436f6d6d697373696f6e017a7071882d5530146d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00200056000000004661766f722053636f757420457363726f773a20506c6174666f726d20436f6d6d697373696f6e0104db3c22018070708100a0882c5530146d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00230044000000004661766f722053636f757420457363726f773a2047617320726566756e6404fc30f8416f2410235f03820082b32ac001917f932ac003e2f2f45307c7058e1c308200b3ab09c00119f2f48200bc4929c20094f8232abe9170e2f2f48e15398200a5c35396c70592397f945198c705e219f2f4e27470708100a0882a5530146d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb08a8ae2252627280054000000004661766f722053636f757420457363726f773a20526566756e6420746f20437573746f6d657200065bcf81001a58cf8680cf8480f400f400cf810070f400c901fb00107910681057104610354403c87f01ca005590509ace17ce15ce03c8ce12cb3fcb0712cb1f58fa0212cb0712cb3fcdc9ed5402d0f8416f2410235f038200e1455318c70592317f945117c705e2f2f48200800c09c00119f2f481390629c20094f8232ab99170e2f2f47388108a107910681057104610354140f8427f705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb002a2b006c000000004469737075746520726567697374657265642e204177616974696e6720706c6174666f726d206172626974726174696f6e2e004cc87f01ca005590509ace17ce15ce03c8ce12cb3fcb0712cb1f58fa0212cb0712cb3fcdc9ed542891b7c1');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initFavorScoutEscrow_init_args({ $$type: 'FavorScoutEscrow_init_args', platform, customer, freelancer, scout, dealId, expectedAmount, scoutCommissionSharePercent, deadlineDurationSeconds })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const FavorScoutEscrow_errors = {
    2: { message: "Stack underflow" },
    3: { message: "Stack overflow" },
    4: { message: "Integer overflow" },
    5: { message: "Integer out of expected range" },
    6: { message: "Invalid opcode" },
    7: { message: "Type check error" },
    8: { message: "Cell overflow" },
    9: { message: "Cell underflow" },
    10: { message: "Dictionary error" },
    11: { message: "'Unknown' error" },
    12: { message: "Fatal error" },
    13: { message: "Out of gas error" },
    14: { message: "Virtualization error" },
    32: { message: "Action list is invalid" },
    33: { message: "Action list is too long" },
    34: { message: "Action is invalid or not supported" },
    35: { message: "Invalid source address in outbound message" },
    36: { message: "Invalid destination address in outbound message" },
    37: { message: "Not enough Toncoin" },
    38: { message: "Not enough extra currencies" },
    39: { message: "Outbound message does not fit into a cell after rewriting" },
    40: { message: "Cannot process a message" },
    41: { message: "Library reference is null" },
    42: { message: "Library change action error" },
    43: { message: "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree" },
    50: { message: "Account state size exceeded limits" },
    128: { message: "Null reference exception" },
    129: { message: "Invalid serialization prefix" },
    130: { message: "Invalid incoming message" },
    131: { message: "Constraints error" },
    132: { message: "Access denied" },
    133: { message: "Contract stopped" },
    134: { message: "Invalid argument" },
    135: { message: "Code of a contract was not found" },
    136: { message: "Invalid standard address" },
    138: { message: "Not a basechain address" },
    6722: { message: "Percentage must be between 0 and 100" },
    14598: { message: "Deadline reached" },
    21835: { message: "Only customer can deposit" },
    23964: { message: "Expected amount must be positive" },
    32780: { message: "Can only dispute active agreements" },
    33459: { message: "Invalid escrow status" },
    35739: { message: "Already deposited" },
    36057: { message: "Deposit is below expected amount plus reserve" },
    42435: { message: "Not authorized" },
    45284: { message: "Agreement must be disputed" },
    45995: { message: "Customer deadline refund requires an active escrow" },
    48201: { message: "Deadline not reached" },
    57229: { message: "Only platform can resolve disputes" },
    57669: { message: "Only participants can dispute" },
    59014: { message: "Deadline duration must be positive" },
} as const

export const FavorScoutEscrow_errors_backward = {
    "Stack underflow": 2,
    "Stack overflow": 3,
    "Integer overflow": 4,
    "Integer out of expected range": 5,
    "Invalid opcode": 6,
    "Type check error": 7,
    "Cell overflow": 8,
    "Cell underflow": 9,
    "Dictionary error": 10,
    "'Unknown' error": 11,
    "Fatal error": 12,
    "Out of gas error": 13,
    "Virtualization error": 14,
    "Action list is invalid": 32,
    "Action list is too long": 33,
    "Action is invalid or not supported": 34,
    "Invalid source address in outbound message": 35,
    "Invalid destination address in outbound message": 36,
    "Not enough Toncoin": 37,
    "Not enough extra currencies": 38,
    "Outbound message does not fit into a cell after rewriting": 39,
    "Cannot process a message": 40,
    "Library reference is null": 41,
    "Library change action error": 42,
    "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree": 43,
    "Account state size exceeded limits": 50,
    "Null reference exception": 128,
    "Invalid serialization prefix": 129,
    "Invalid incoming message": 130,
    "Constraints error": 131,
    "Access denied": 132,
    "Contract stopped": 133,
    "Invalid argument": 134,
    "Code of a contract was not found": 135,
    "Invalid standard address": 136,
    "Not a basechain address": 138,
    "Percentage must be between 0 and 100": 6722,
    "Deadline reached": 14598,
    "Only customer can deposit": 21835,
    "Expected amount must be positive": 23964,
    "Can only dispute active agreements": 32780,
    "Invalid escrow status": 33459,
    "Already deposited": 35739,
    "Deposit is below expected amount plus reserve": 36057,
    "Not authorized": 42435,
    "Agreement must be disputed": 45284,
    "Customer deadline refund requires an active escrow": 45995,
    "Deadline not reached": 48201,
    "Only platform can resolve disputes": 57229,
    "Only participants can dispute": 57669,
    "Deadline duration must be positive": 59014,
} as const

const FavorScoutEscrow_types: ABIType[] = [
    {"name":"DataSize","header":null,"fields":[{"name":"cells","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bits","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"refs","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"SignedBundle","header":null,"fields":[{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signedData","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"StateInit","header":null,"fields":[{"name":"code","type":{"kind":"simple","type":"cell","optional":false}},{"name":"data","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"Context","header":null,"fields":[{"name":"bounceable","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"raw","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"SendParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"code","type":{"kind":"simple","type":"cell","optional":true}},{"name":"data","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"MessageParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"DeployParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}},{"name":"init","type":{"kind":"simple","type":"StateInit","optional":false}}]},
    {"name":"StdAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":8}},{"name":"address","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"VarAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":32}},{"name":"address","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"BasechainAddress","header":null,"fields":[{"name":"hash","type":{"kind":"simple","type":"int","optional":true,"format":257}}]},
    {"name":"Deploy","header":2490013878,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"DeployOk","header":2952335191,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FactoryDeploy","header":1829761339,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"cashback","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ResolveScoutDispute","header":450855303,"fields":[{"name":"freelancerPercent","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"FavorScoutEscrow$Data","header":null,"fields":[{"name":"platform","type":{"kind":"simple","type":"address","optional":false}},{"name":"customer","type":{"kind":"simple","type":"address","optional":false}},{"name":"freelancer","type":{"kind":"simple","type":"address","optional":false}},{"name":"scout","type":{"kind":"simple","type":"address","optional":false}},{"name":"dealId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"scoutCommissionSharePercent","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"deadlineDurationSeconds","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"status","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"deadlineAt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const FavorScoutEscrow_opcodes = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "ResolveScoutDispute": 450855303,
}

const FavorScoutEscrow_getters: ABIGetter[] = [
    {"name":"status","methodId":101642,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"deadlineAt","methodId":114650,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"details","methodId":118890,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"scoutAddress","methodId":67900,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"scoutSharePercent","methodId":71443,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
]

export const FavorScoutEscrow_getterMapping: { [key: string]: string } = {
    'status': 'getStatus',
    'deadlineAt': 'getDeadlineAt',
    'details': 'getDetails',
    'scoutAddress': 'getScoutAddress',
    'scoutSharePercent': 'getScoutSharePercent',
}

const FavorScoutEscrow_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"empty"}},
    {"receiver":"internal","message":{"kind":"text","text":"complete"}},
    {"receiver":"internal","message":{"kind":"text","text":"refund"}},
    {"receiver":"internal","message":{"kind":"text","text":"dispute"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ResolveScoutDispute"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Deploy"}},
]

export const PLATFORM_COMMISSION_PERCENT = 5n;
export const STORAGE_RESERVE = 50000000n;

export class FavorScoutEscrow implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = FavorScoutEscrow_errors_backward;
    public static readonly opcodes = FavorScoutEscrow_opcodes;
    
    static async init(platform: Address, customer: Address, freelancer: Address, scout: Address, dealId: bigint, expectedAmount: bigint, scoutCommissionSharePercent: bigint, deadlineDurationSeconds: bigint) {
        return await FavorScoutEscrow_init(platform, customer, freelancer, scout, dealId, expectedAmount, scoutCommissionSharePercent, deadlineDurationSeconds);
    }
    
    static async fromInit(platform: Address, customer: Address, freelancer: Address, scout: Address, dealId: bigint, expectedAmount: bigint, scoutCommissionSharePercent: bigint, deadlineDurationSeconds: bigint) {
        const __gen_init = await FavorScoutEscrow_init(platform, customer, freelancer, scout, dealId, expectedAmount, scoutCommissionSharePercent, deadlineDurationSeconds);
        const address = contractAddress(0, __gen_init);
        return new FavorScoutEscrow(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new FavorScoutEscrow(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  FavorScoutEscrow_types,
        getters: FavorScoutEscrow_getters,
        receivers: FavorScoutEscrow_receivers,
        errors: FavorScoutEscrow_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: null | "complete" | "refund" | "dispute" | ResolveScoutDispute | Deploy) {
        
        let body: Cell | null = null;
        if (message === null) {
            body = new Cell();
        }
        if (message === "complete") {
            body = beginCell().storeUint(0, 32).storeStringTail(message).endCell();
        }
        if (message === "refund") {
            body = beginCell().storeUint(0, 32).storeStringTail(message).endCell();
        }
        if (message === "dispute") {
            body = beginCell().storeUint(0, 32).storeStringTail(message).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ResolveScoutDispute') {
            body = beginCell().store(storeResolveScoutDispute(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Deploy') {
            body = beginCell().store(storeDeploy(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getStatus(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('status', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getDeadlineAt(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('deadlineAt', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }

    async getDetails(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('details', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getScoutAddress(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('scoutAddress', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getScoutSharePercent(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('scoutSharePercent', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
}
