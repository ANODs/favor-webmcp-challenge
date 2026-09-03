import "@stdlib/deploy";

const PLATFORM_COMMISSION_PERCENT: Int = 5;
const JETTON_TRANSFER_TON: Int = 60000000;

message ResolveStablecoinDispute {
    freelancerPercent: Int as uint8;
}

message ConfigureJettonWallet {
    jettonWallet: Address;
}

message(0x7362d09c) JettonTransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Slice as remaining;
}

contract FavorStablecoinJettonEscrow with Deployable {
    platform: Address;
    customer: Address;
    freelancer: Address;
    scout: Address;
    jettonMaster: Address;
    escrowJettonWallet: Address;
    jettonWalletConfigured: Bool;
    dealId: Int as uint64;
    expectedAmount: Int as coins;
    scoutCommissionSharePercent: Int as uint8;
    deadlineDurationSeconds: Int as uint32;

    amount: Int as coins;
    status: Int as uint8;
    deadlineAt: Int as uint64;

    init(
        platform: Address,
        customer: Address,
        freelancer: Address,
        scout: Address,
        jettonMaster: Address,
        dealId: Int,
        expectedAmount: Int,
        scoutCommissionSharePercent: Int,
        deadlineDurationSeconds: Int
    ) {
        self.platform = platform;
        self.customer = customer;
        self.freelancer = freelancer;
        self.scout = scout;
        self.jettonMaster = jettonMaster;
        self.escrowJettonWallet = platform;
        self.jettonWalletConfigured = false;
        self.dealId = dealId;
        self.expectedAmount = expectedAmount;
        self.scoutCommissionSharePercent = scoutCommissionSharePercent;
        require(deadlineDurationSeconds > 0, "Deadline duration must be positive");
        self.deadlineDurationSeconds = deadlineDurationSeconds;
        self.amount = 0;
        self.status = 0;
        self.deadlineAt = 0;
    }

    receive() {
        let ctx: Context = context();
        require(ctx.sender == self.customer || ctx.sender == self.platform, "Not authorized");
        require(ctx.value > 50000000, "Deploy gas missing");
    }

    receive(msg: ConfigureJettonWallet) {
        let ctx: Context = context();
        require(ctx.sender == self.customer || ctx.sender == self.platform, "Not authorized");
        require(!self.jettonWalletConfigured, "Jetton wallet already configured");

        self.escrowJettonWallet = msg.jettonWallet;
        self.jettonWalletConfigured = true;
    }

    receive(msg: JettonTransferNotification) {
        let ctx: Context = context();
        require(self.status == 0, "Already deposited");
        require(self.jettonWalletConfigured, "Jetton wallet is not configured");
        require(ctx.sender == self.escrowJettonWallet, "Invalid jetton wallet");
        require(msg.sender == self.customer, "Only customer can deposit");
        require(msg.amount == self.expectedAmount, "Jetton deposit must match expected amount");

        self.amount = msg.amount;
        self.status = 1;
        self.deadlineAt = now() + self.deadlineDurationSeconds;
    }

    receive("complete") {
        let ctx: Context = context();
        require(ctx.sender == self.customer || ctx.sender == self.platform, "Not authorized");
        require(self.status == 1 || self.status == 3, "Invalid escrow status");

        self.status = 2;
        self.distributeFreelancerShare(self.amount);
        self.closeGas();
    }

    receive("refund") {
        let ctx: Context = context();
        require(self.status == 1 || self.status == 3, "Invalid escrow status");

        if (ctx.sender == self.customer) {
            require(self.status == 1, "Customer deadline refund requires an active escrow");
            require(
                self.deadlineAt > 0 && now() >= self.deadlineAt,
                "Deadline not reached"
            );
        } else {
            require(
                ctx.sender == self.freelancer || ctx.sender == self.platform,
                "Not authorized"
            );
        }

        self.status = 4;
        self.sendJettons(self.customer, self.amount);
        self.closeGas();
    }

    receive("dispute") {
        let ctx: Context = context();
        require(ctx.sender == self.customer || ctx.sender == self.freelancer, "Only participants can dispute");
        require(self.status == 1, "Can only dispute active agreements");
        require(self.deadlineAt > 0 && now() < self.deadlineAt, "Deadline reached");

        self.status = 3;
        self.reply("Dispute registered. Awaiting platform arbitration.".asComment());
    }

    receive(msg: ResolveStablecoinDispute) {
        let ctx: Context = context();
        require(ctx.sender == self.platform, "Only platform can resolve disputes");
        require(self.status == 3, "Agreement must be disputed");
        require(msg.freelancerPercent <= 100, "Percentage must be between 0 and 100");

        self.status = 2;

        let freelancerAmt: Int = (self.amount * msg.freelancerPercent) / 100;
        let customerAmt: Int = self.amount - freelancerAmt;

        if (customerAmt > 0) {
            self.sendJettons(self.customer, customerAmt);
        }

        if (freelancerAmt > 0) {
            self.distributeFreelancerShare(freelancerAmt);
        }

        self.closeGas();
    }

    fun distributeFreelancerShare(freelancerGrossAmount: Int) {
        let commission: Int = (freelancerGrossAmount * PLATFORM_COMMISSION_PERCENT) / 100;
        let scoutShare: Int = (commission * self.scoutCommissionSharePercent) / 100;
        let platformShare: Int = commission - scoutShare;
        let freelancerShare: Int = freelancerGrossAmount - commission;

        if (freelancerShare > 0) {
            self.sendJettons(self.freelancer, freelancerShare);
        }

        if (scoutShare > 0) {
            self.sendJettons(self.scout, scoutShare);
        }

        if (platformShare > 0) {
            self.sendJettons(self.platform, platformShare);
        }
    }

    fun sendJettons(to: Address, jettonAmount: Int) {
        let body: Cell = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)
            .storeCoins(jettonAmount)
            .storeAddress(to)
            .storeAddress(self.customer)
            .storeBit(false)
            .storeCoins(0)
            .storeBit(false)
            .endCell();

        send(SendParameters{
            to: self.escrowJettonWallet,
            value: JETTON_TRANSFER_TON,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: body
        });
    }

    fun closeGas() {
        send(SendParameters{
            to: self.customer,
            value: 0,
            bounce: false,
            mode: SendRemainingBalance + SendDestroyIfZero,
            body: "Favor Stablecoin Escrow: Gas refund".asComment()
        });
    }

    get fun status(): Int {
        return self.status;
    }

    get fun deadlineAt(): Int {
        return self.deadlineAt;
    }

    get fun details(): Address {
        return myAddress();
    }

    get fun jettonWallet(): Address {
        return self.escrowJettonWallet;
    }

    get fun jettonMasterAddress(): Address {
        return self.jettonMaster;
    }
}
