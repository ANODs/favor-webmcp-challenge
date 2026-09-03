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

export type ResolveStablecoinDispute = {
    $$type: 'ResolveStablecoinDispute';
    freelancerPercent: bigint;
}

export function storeResolveStablecoinDispute(src: ResolveStablecoinDispute) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4214219585, 32);
        b_0.storeUint(src.freelancerPercent, 8);
    };
}

export function loadResolveStablecoinDispute(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4214219585) { throw Error('Invalid prefix'); }
    const _freelancerPercent = sc_0.loadUintBig(8);
    return { $$type: 'ResolveStablecoinDispute' as const, freelancerPercent: _freelancerPercent };
}

export function loadTupleResolveStablecoinDispute(source: TupleReader) {
    const _freelancerPercent = source.readBigNumber();
    return { $$type: 'ResolveStablecoinDispute' as const, freelancerPercent: _freelancerPercent };
}

export function loadGetterTupleResolveStablecoinDispute(source: TupleReader) {
    const _freelancerPercent = source.readBigNumber();
    return { $$type: 'ResolveStablecoinDispute' as const, freelancerPercent: _freelancerPercent };
}

export function storeTupleResolveStablecoinDispute(source: ResolveStablecoinDispute) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.freelancerPercent);
    return builder.build();
}

export function dictValueParserResolveStablecoinDispute(): DictionaryValue<ResolveStablecoinDispute> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeResolveStablecoinDispute(src)).endCell());
        },
        parse: (src) => {
            return loadResolveStablecoinDispute(src.loadRef().beginParse());
        }
    }
}

export type ConfigureJettonWallet = {
    $$type: 'ConfigureJettonWallet';
    jettonWallet: Address;
}

export function storeConfigureJettonWallet(src: ConfigureJettonWallet) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(308508065, 32);
        b_0.storeAddress(src.jettonWallet);
    };
}

export function loadConfigureJettonWallet(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 308508065) { throw Error('Invalid prefix'); }
    const _jettonWallet = sc_0.loadAddress();
    return { $$type: 'ConfigureJettonWallet' as const, jettonWallet: _jettonWallet };
}

export function loadTupleConfigureJettonWallet(source: TupleReader) {
    const _jettonWallet = source.readAddress();
    return { $$type: 'ConfigureJettonWallet' as const, jettonWallet: _jettonWallet };
}

export function loadGetterTupleConfigureJettonWallet(source: TupleReader) {
    const _jettonWallet = source.readAddress();
    return { $$type: 'ConfigureJettonWallet' as const, jettonWallet: _jettonWallet };
}

export function storeTupleConfigureJettonWallet(source: ConfigureJettonWallet) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.jettonWallet);
    return builder.build();
}

export function dictValueParserConfigureJettonWallet(): DictionaryValue<ConfigureJettonWallet> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeConfigureJettonWallet(src)).endCell());
        },
        parse: (src) => {
            return loadConfigureJettonWallet(src.loadRef().beginParse());
        }
    }
}

export type JettonTransferNotification = {
    $$type: 'JettonTransferNotification';
    queryId: bigint;
    amount: bigint;
    sender: Address;
    forwardPayload: Slice;
}

export function storeJettonTransferNotification(src: JettonTransferNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1935855772, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeCoins(src.amount);
        b_0.storeAddress(src.sender);
        b_0.storeBuilder(src.forwardPayload.asBuilder());
    };
}

export function loadJettonTransferNotification(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1935855772) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _amount = sc_0.loadCoins();
    const _sender = sc_0.loadAddress();
    const _forwardPayload = sc_0;
    return { $$type: 'JettonTransferNotification' as const, queryId: _queryId, amount: _amount, sender: _sender, forwardPayload: _forwardPayload };
}

export function loadTupleJettonTransferNotification(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender = source.readAddress();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'JettonTransferNotification' as const, queryId: _queryId, amount: _amount, sender: _sender, forwardPayload: _forwardPayload };
}

export function loadGetterTupleJettonTransferNotification(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender = source.readAddress();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'JettonTransferNotification' as const, queryId: _queryId, amount: _amount, sender: _sender, forwardPayload: _forwardPayload };
}

export function storeTupleJettonTransferNotification(source: JettonTransferNotification) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender);
    builder.writeSlice(source.forwardPayload.asCell());
    return builder.build();
}

export function dictValueParserJettonTransferNotification(): DictionaryValue<JettonTransferNotification> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeJettonTransferNotification(src)).endCell());
        },
        parse: (src) => {
            return loadJettonTransferNotification(src.loadRef().beginParse());
        }
    }
}

export type FavorStablecoinJettonEscrow$Data = {
    $$type: 'FavorStablecoinJettonEscrow$Data';
    platform: Address;
    customer: Address;
    freelancer: Address;
    scout: Address;
    jettonMaster: Address;
    escrowJettonWallet: Address;
    jettonWalletConfigured: boolean;
    dealId: bigint;
    expectedAmount: bigint;
    scoutCommissionSharePercent: bigint;
    deadlineDurationSeconds: bigint;
    amount: bigint;
    status: bigint;
    deadlineAt: bigint;
}

export function storeFavorStablecoinJettonEscrow$Data(src: FavorStablecoinJettonEscrow$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.platform);
        b_0.storeAddress(src.customer);
        b_0.storeAddress(src.freelancer);
        const b_1 = new Builder();
        b_1.storeAddress(src.scout);
        b_1.storeAddress(src.jettonMaster);
        b_1.storeAddress(src.escrowJettonWallet);
        b_1.storeBit(src.jettonWalletConfigured);
        b_1.storeUint(src.dealId, 64);
        b_1.storeCoins(src.expectedAmount);
        b_1.storeUint(src.scoutCommissionSharePercent, 8);
        const b_2 = new Builder();
        b_2.storeUint(src.deadlineDurationSeconds, 32);
        b_2.storeCoins(src.amount);
        b_2.storeUint(src.status, 8);
        b_2.storeUint(src.deadlineAt, 64);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadFavorStablecoinJettonEscrow$Data(slice: Slice) {
    const sc_0 = slice;
    const _platform = sc_0.loadAddress();
    const _customer = sc_0.loadAddress();
    const _freelancer = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _scout = sc_1.loadAddress();
    const _jettonMaster = sc_1.loadAddress();
    const _escrowJettonWallet = sc_1.loadAddress();
    const _jettonWalletConfigured = sc_1.loadBit();
    const _dealId = sc_1.loadUintBig(64);
    const _expectedAmount = sc_1.loadCoins();
    const _scoutCommissionSharePercent = sc_1.loadUintBig(8);
    const sc_2 = sc_1.loadRef().beginParse();
    const _deadlineDurationSeconds = sc_2.loadUintBig(32);
    const _amount = sc_2.loadCoins();
    const _status = sc_2.loadUintBig(8);
    const _deadlineAt = sc_2.loadUintBig(64);
    return { $$type: 'FavorStablecoinJettonEscrow$Data' as const, platform: _platform, customer: _customer, freelancer: _freelancer, scout: _scout, jettonMaster: _jettonMaster, escrowJettonWallet: _escrowJettonWallet, jettonWalletConfigured: _jettonWalletConfigured, dealId: _dealId, expectedAmount: _expectedAmount, scoutCommissionSharePercent: _scoutCommissionSharePercent, deadlineDurationSeconds: _deadlineDurationSeconds, amount: _amount, status: _status, deadlineAt: _deadlineAt };
}

export function loadTupleFavorStablecoinJettonEscrow$Data(source: TupleReader) {
    const _platform = source.readAddress();
    const _customer = source.readAddress();
    const _freelancer = source.readAddress();
    const _scout = source.readAddress();
    const _jettonMaster = source.readAddress();
    const _escrowJettonWallet = source.readAddress();
    const _jettonWalletConfigured = source.readBoolean();
    const _dealId = source.readBigNumber();
    const _expectedAmount = source.readBigNumber();
    const _scoutCommissionSharePercent = source.readBigNumber();
    const _deadlineDurationSeconds = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _status = source.readBigNumber();
    const _deadlineAt = source.readBigNumber();
    return { $$type: 'FavorStablecoinJettonEscrow$Data' as const, platform: _platform, customer: _customer, freelancer: _freelancer, scout: _scout, jettonMaster: _jettonMaster, escrowJettonWallet: _escrowJettonWallet, jettonWalletConfigured: _jettonWalletConfigured, dealId: _dealId, expectedAmount: _expectedAmount, scoutCommissionSharePercent: _scoutCommissionSharePercent, deadlineDurationSeconds: _deadlineDurationSeconds, amount: _amount, status: _status, deadlineAt: _deadlineAt };
}

export function loadGetterTupleFavorStablecoinJettonEscrow$Data(source: TupleReader) {
    const _platform = source.readAddress();
    const _customer = source.readAddress();
    const _freelancer = source.readAddress();
    const _scout = source.readAddress();
    const _jettonMaster = source.readAddress();
    const _escrowJettonWallet = source.readAddress();
    const _jettonWalletConfigured = source.readBoolean();
    const _dealId = source.readBigNumber();
    const _expectedAmount = source.readBigNumber();
    const _scoutCommissionSharePercent = source.readBigNumber();
    const _deadlineDurationSeconds = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _status = source.readBigNumber();
    const _deadlineAt = source.readBigNumber();
    return { $$type: 'FavorStablecoinJettonEscrow$Data' as const, platform: _platform, customer: _customer, freelancer: _freelancer, scout: _scout, jettonMaster: _jettonMaster, escrowJettonWallet: _escrowJettonWallet, jettonWalletConfigured: _jettonWalletConfigured, dealId: _dealId, expectedAmount: _expectedAmount, scoutCommissionSharePercent: _scoutCommissionSharePercent, deadlineDurationSeconds: _deadlineDurationSeconds, amount: _amount, status: _status, deadlineAt: _deadlineAt };
}

export function storeTupleFavorStablecoinJettonEscrow$Data(source: FavorStablecoinJettonEscrow$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.platform);
    builder.writeAddress(source.customer);
    builder.writeAddress(source.freelancer);
    builder.writeAddress(source.scout);
    builder.writeAddress(source.jettonMaster);
    builder.writeAddress(source.escrowJettonWallet);
    builder.writeBoolean(source.jettonWalletConfigured);
    builder.writeNumber(source.dealId);
    builder.writeNumber(source.expectedAmount);
    builder.writeNumber(source.scoutCommissionSharePercent);
    builder.writeNumber(source.deadlineDurationSeconds);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.status);
    builder.writeNumber(source.deadlineAt);
    return builder.build();
}

export function dictValueParserFavorStablecoinJettonEscrow$Data(): DictionaryValue<FavorStablecoinJettonEscrow$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFavorStablecoinJettonEscrow$Data(src)).endCell());
        },
        parse: (src) => {
            return loadFavorStablecoinJettonEscrow$Data(src.loadRef().beginParse());
        }
    }
}

 type FavorStablecoinJettonEscrow_init_args = {
    $$type: 'FavorStablecoinJettonEscrow_init_args';
    platform: Address;
    customer: Address;
    freelancer: Address;
    scout: Address;
    jettonMaster: Address;
    dealId: bigint;
    expectedAmount: bigint;
    scoutCommissionSharePercent: bigint;
    deadlineDurationSeconds: bigint;
}

function initFavorStablecoinJettonEscrow_init_args(src: FavorStablecoinJettonEscrow_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.platform);
        b_0.storeAddress(src.customer);
        b_0.storeAddress(src.freelancer);
        const b_1 = new Builder();
        b_1.storeAddress(src.scout);
        b_1.storeAddress(src.jettonMaster);
        b_1.storeInt(src.dealId, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.expectedAmount, 257);
        b_2.storeInt(src.scoutCommissionSharePercent, 257);
        b_2.storeInt(src.deadlineDurationSeconds, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

async function FavorStablecoinJettonEscrow_init(platform: Address, customer: Address, freelancer: Address, scout: Address, jettonMaster: Address, dealId: bigint, expectedAmount: bigint, scoutCommissionSharePercent: bigint, deadlineDurationSeconds: bigint) {
    const __code = Cell.fromHex('b5ee9c72410227010009ac000262ff008e88f4a413f4bcf2c80bed53208e9c30eda2edfb01d072d721d200d200fa4021103450666f04f86102f862e1ed43d90114020271020501fbbf00af6a268690000c715fd207d207d206a00e87d207d207d206900699ffd006983ea1868698ffd006983e99f98085f085e885e360f4722fd207d207d206a00e87d207d20408080eb806a1868408080eb80408080eb80408080eb801808348834083384e8aa8394384100734311e100797a382980082688242f19881af14030108db3c6ce1040002280201200611020120070e020120080b01fbb342bb5134348000638afe903e903e903500743e903e903e90348034cffe8034c1f50c3434c7fe8034c1f4cfcc042f842f442f1b07a3917e903e903e903500743e903e9020404075c0350c3420404075c020404075c020404075c00c041a441a0419c2745541ca1c208039a188f0803cbd1c14c004134412178cc40d78a0090108db3c6ce10a00022101fbb34e7b5134348000638afe903e903e903500743e903e903e90348034cffe8034c1f50c3434c7fe8034c1f4cfcc042f842f442f1b07a3917e903e903e903500743e903e9020404075c0350c3420404075c020404075c020404075c00c041a441a0419c2745541ca1c208039a188f0803cbd1c14c004134412178cc40d78a00c0108db3c6ce10d00022901fbb7fb5da89a1a400031c57f481f481f481a803a1f481f481f481a401a67ff401a60fa861a1a63ff401a60fa67e60217c217a2178d83d1c8bf481f481f481a803a1f481f481020203ae01a861a1020203ae01020203ae01020203ae006020d220d020ce13a2aa0e50e10401cd0c478401e5e8e0a600209a2090bc66206bc500f0108db3c6ce11000022001fbb906aed44d0d200018e2bfa40fa40fa40d401d0fa40fa40fa40d200d33ffa00d307d430d0d31ffa00d307d33f3010be10bd10bc6c1e8e45fa40fa40fa40d401d0fa40fa40810101d700d430d0810101d700810101d700810101d7003010691068106709d1550728708200e68623c200f2f4705300104d10485e331035e28120108db3c6ce1130004f82802feed44d0d200018e2bfa40fa40fa40d401d0fa40fa40fa40d200d33ffa00d307d430d0d31ffa00d307d33f3010be10bd10bc6c1e8e45fa40fa40fa40d401d0fa40fa40810101d700d430d0810101d700810101d700810101d7003010691068106709d1550728708200e68623c200f2f4705300104d10485e331035e20fe30270151600045f0f02e62ed74920c21fe30001c00001c121b08e5d3df8416f2430328200a5c3531dc70592317f94511ec705e2f2f4820082f201820afaf080bcf2f410bd551ac87f01ca0055d050dece1bce19ce07c8ce16ce14ce12ca00cb3f01fa02cb0702c8cb1f5003fa0213cb0713cb3fcdcdc9ed54e00df90120171d04fe310ed31f218210126375a1bae3022182107362d09cba8edc31323d3d0cd33f31fa00fa4030f8416f2410235f0382008b9b0ec0001ef2f48200f60426f2f4812cb651d7c7051df2f481554b51cac7051cf2f48200c9f253b2baf2f471f8232da010bd10ac109b108a107910681057104610351024e0218210fb2fe341bae302181c191b00e431383d06fa4030f8416f2410235f038200a5c3531cc70592317f94511dc705e2f2f481428b06b316f2f410ac109b108a1079106810477f07104610354430c87f01ca0055d050dece1bce19ce07c8ce16ce14ce12ca00cb3f01fa02cb0702c8cb1f5003fa0213cb0713cb3fcdcdc9ed54db3104e2313e0dd30730f8416f245b8200df8d322ec705f2f48200b0e40ec0031ef2f4811a422dc165f2f420720ea88064a9045ca120c2008eab2c0e0f10cd10bc10ab109a1089107810671056104503040211100201db3c50de1c1b1a19181716151443309130e220c2009130e30d10bd551adb3c211a221c013810ce10bd10ac109b108a10791068105710461035443012db3c0d55a11f01b4218210946a98b6ba8ece313e0dd33f30c8018210aff90f5758cb1fcb3fc910ce10bd10ac109b108a10791068105710461035443012f84270705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00e00f1c0068c87f01ca0055d050dece1bce19ce07c8ce16ce14ce12ca00cb3f01fa02cb0702c8cb1f5003fa0213cb0713cb3fcdcdc9ed54db3103ea82f0f29fa7e2b166aa5aa95ed61d3477f8d1ef25469d0a1be9360a76bf7b423bc151bae3022082f02282abf8277dc4ff9183255e3d0fb487fa3963bcea406ca8943205a96e5346cdbae30282f0054e0a8595d08326d56c73cd5dca85c1e629fe1e418a935a3b82b7e558803707bae3025f0ef2c0821e202402d630f8416f2410235f038200a5c3531cc70592317f94511dc705e2f2f4820082b32dc001923d7f930dc003e21df2f410ac5519725112db3cdb3cc87f01ca0055d050dece1bce19ce07c8ce16ce14ce12ca00cb3f01fa02cb0702c8cb1f5003fa0213cb0713cb3fcdcdc9ed541f2203ea20a7058064a9045306a88064a9045ca15aa120c2008ead0e11100e10df56100d0c11100c0b0a11100a0908111008070611100605041110040302111002111101db3c551d9130e221c2008e9a10ef10df10cf2f0c0b0a090807060504431301111001db3c550d9131e220c2008e8452e0db3c9130e221212103e230f8416f2410235f03820082b32ec001917f932ec003e2f2f4530bc7058e1c308200b3ab0dc0011df2f48200bc492dc20094f8232ebe9170e2f2f48e153d8200a5c353dac705923d7f9451dcc705e21df2f4e210ac742a0d10ac109b108a107910682010681057104610354344db3cdb3c21222600c67070c882100f8a7ea501cb1f7001cb3f5003fa025003cf162fcf16ca0070fa02ca00c9820b9387007f712c04146d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00018270708100a08856105530146d50436d5033c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0023004e000000004661766f7220537461626c65636f696e20457363726f773a2047617320726566756e6402e0f8416f2410235f038200e145531cc70592317f94511bc705e2f2f48200800c0dc0011df2f48139062dc20094f8232eb99170e2f2f4738810ce10bd10ac109b108a107910681057104610354140f8427f705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb002526006c000000004469737075746520726567697374657265642e204177616974696e6720706c6174666f726d206172626974726174696f6e2e0064c87f01ca0055d050dece1bce19ce07c8ce16ce14ce12ca00cb3f01fa02cb0702c8cb1f5003fa0213cb0713cb3fcdcdc9ed54fbffa066');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initFavorStablecoinJettonEscrow_init_args({ $$type: 'FavorStablecoinJettonEscrow_init_args', platform, customer, freelancer, scout, jettonMaster, dealId, expectedAmount, scoutCommissionSharePercent, deadlineDurationSeconds })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const FavorStablecoinJettonEscrow_errors = {
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
    11446: { message: "Invalid jetton wallet" },
    14598: { message: "Deadline reached" },
    17035: { message: "Jetton wallet already configured" },
    21835: { message: "Only customer can deposit" },
    32780: { message: "Can only dispute active agreements" },
    33459: { message: "Invalid escrow status" },
    33522: { message: "Deploy gas missing" },
    35739: { message: "Already deposited" },
    42435: { message: "Not authorized" },
    45284: { message: "Agreement must be disputed" },
    45995: { message: "Customer deadline refund requires an active escrow" },
    48201: { message: "Deadline not reached" },
    51698: { message: "Jetton deposit must match expected amount" },
    57229: { message: "Only platform can resolve disputes" },
    57669: { message: "Only participants can dispute" },
    59014: { message: "Deadline duration must be positive" },
    62980: { message: "Jetton wallet is not configured" },
} as const

export const FavorStablecoinJettonEscrow_errors_backward = {
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
    "Invalid jetton wallet": 11446,
    "Deadline reached": 14598,
    "Jetton wallet already configured": 17035,
    "Only customer can deposit": 21835,
    "Can only dispute active agreements": 32780,
    "Invalid escrow status": 33459,
    "Deploy gas missing": 33522,
    "Already deposited": 35739,
    "Not authorized": 42435,
    "Agreement must be disputed": 45284,
    "Customer deadline refund requires an active escrow": 45995,
    "Deadline not reached": 48201,
    "Jetton deposit must match expected amount": 51698,
    "Only platform can resolve disputes": 57229,
    "Only participants can dispute": 57669,
    "Deadline duration must be positive": 59014,
    "Jetton wallet is not configured": 62980,
} as const

const FavorStablecoinJettonEscrow_types: ABIType[] = [
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
    {"name":"ResolveStablecoinDispute","header":4214219585,"fields":[{"name":"freelancerPercent","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ConfigureJettonWallet","header":308508065,"fields":[{"name":"jettonWallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"JettonTransferNotification","header":1935855772,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"forwardPayload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"FavorStablecoinJettonEscrow$Data","header":null,"fields":[{"name":"platform","type":{"kind":"simple","type":"address","optional":false}},{"name":"customer","type":{"kind":"simple","type":"address","optional":false}},{"name":"freelancer","type":{"kind":"simple","type":"address","optional":false}},{"name":"scout","type":{"kind":"simple","type":"address","optional":false}},{"name":"jettonMaster","type":{"kind":"simple","type":"address","optional":false}},{"name":"escrowJettonWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"jettonWalletConfigured","type":{"kind":"simple","type":"bool","optional":false}},{"name":"dealId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"expectedAmount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"scoutCommissionSharePercent","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"deadlineDurationSeconds","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"status","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"deadlineAt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const FavorStablecoinJettonEscrow_opcodes = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "ResolveStablecoinDispute": 4214219585,
    "ConfigureJettonWallet": 308508065,
    "JettonTransferNotification": 1935855772,
}

const FavorStablecoinJettonEscrow_getters: ABIGetter[] = [
    {"name":"status","methodId":101642,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"deadlineAt","methodId":114650,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"details","methodId":118890,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"jettonWallet","methodId":90133,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"jettonMasterAddress","methodId":105785,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
]

export const FavorStablecoinJettonEscrow_getterMapping: { [key: string]: string } = {
    'status': 'getStatus',
    'deadlineAt': 'getDeadlineAt',
    'details': 'getDetails',
    'jettonWallet': 'getJettonWallet',
    'jettonMasterAddress': 'getJettonMasterAddress',
}

const FavorStablecoinJettonEscrow_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"empty"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ConfigureJettonWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"JettonTransferNotification"}},
    {"receiver":"internal","message":{"kind":"text","text":"complete"}},
    {"receiver":"internal","message":{"kind":"text","text":"refund"}},
    {"receiver":"internal","message":{"kind":"text","text":"dispute"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ResolveStablecoinDispute"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Deploy"}},
]

export const PLATFORM_COMMISSION_PERCENT = 5n;
export const JETTON_TRANSFER_TON = 60000000n;

export class FavorStablecoinJettonEscrow implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = FavorStablecoinJettonEscrow_errors_backward;
    public static readonly opcodes = FavorStablecoinJettonEscrow_opcodes;
    
    static async init(platform: Address, customer: Address, freelancer: Address, scout: Address, jettonMaster: Address, dealId: bigint, expectedAmount: bigint, scoutCommissionSharePercent: bigint, deadlineDurationSeconds: bigint) {
        return await FavorStablecoinJettonEscrow_init(platform, customer, freelancer, scout, jettonMaster, dealId, expectedAmount, scoutCommissionSharePercent, deadlineDurationSeconds);
    }
    
    static async fromInit(platform: Address, customer: Address, freelancer: Address, scout: Address, jettonMaster: Address, dealId: bigint, expectedAmount: bigint, scoutCommissionSharePercent: bigint, deadlineDurationSeconds: bigint) {
        const __gen_init = await FavorStablecoinJettonEscrow_init(platform, customer, freelancer, scout, jettonMaster, dealId, expectedAmount, scoutCommissionSharePercent, deadlineDurationSeconds);
        const address = contractAddress(0, __gen_init);
        return new FavorStablecoinJettonEscrow(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new FavorStablecoinJettonEscrow(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  FavorStablecoinJettonEscrow_types,
        getters: FavorStablecoinJettonEscrow_getters,
        receivers: FavorStablecoinJettonEscrow_receivers,
        errors: FavorStablecoinJettonEscrow_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: null | ConfigureJettonWallet | JettonTransferNotification | "complete" | "refund" | "dispute" | ResolveStablecoinDispute | Deploy) {
        
        let body: Cell | null = null;
        if (message === null) {
            body = new Cell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ConfigureJettonWallet') {
            body = beginCell().store(storeConfigureJettonWallet(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'JettonTransferNotification') {
            body = beginCell().store(storeJettonTransferNotification(message)).endCell();
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ResolveStablecoinDispute') {
            body = beginCell().store(storeResolveStablecoinDispute(message)).endCell();
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
    
    async getJettonWallet(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('jettonWallet', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getJettonMasterAddress(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('jettonMasterAddress', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
}
