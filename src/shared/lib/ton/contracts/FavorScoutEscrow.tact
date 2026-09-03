import "@stdlib/deploy";

const PLATFORM_COMMISSION_PERCENT: Int = 5;
const STORAGE_RESERVE: Int = 50000000;

message ResolveScoutDispute {
    freelancerPercent: Int as uint8;
}

contract FavorScoutEscrow with Deployable {
    platform: Address;
    customer: Address;
    freelancer: Address;
    scout: Address;
    dealId: Int as uint64;
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
        dealId: Int,
        expectedAmount: Int,
        scoutCommissionSharePercent: Int,
        deadlineDurationSeconds: Int
    ) {
        self.platform = platform;
        self.customer = customer;
        self.freelancer = freelancer;
        self.scout = scout;
        self.dealId = dealId;
        require(expectedAmount > 0, "Expected amount must be positive");
        require(deadlineDurationSeconds > 0, "Deadline duration must be positive");
        self.amount = expectedAmount;
        self.scoutCommissionSharePercent = scoutCommissionSharePercent;
        self.deadlineDurationSeconds = deadlineDurationSeconds;
        self.status = 0;
        self.deadlineAt = 0;
    }

    receive() {
        let ctx: Context = context();
        require(self.status == 0, "Already deposited");
        require(ctx.sender == self.customer, "Only customer can deposit");
        require(ctx.value >= self.amount + STORAGE_RESERVE, "Deposit is below expected amount plus reserve");

        self.status = 1;
        self.deadlineAt = now() + self.deadlineDurationSeconds;
    }

    receive("complete") {
        let ctx: Context = context();
        require(ctx.sender == self.customer || ctx.sender == self.platform, "Not authorized");
        require(self.status == 1 || self.status == 3, "Invalid escrow status");

        self.status = 2;

        self.distributeFreelancerShare(self.amount, "Favor Scout Escrow: Payout");
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

        send(SendParameters{
            to: self.customer,
            value: 0,
            bounce: false,
            mode: SendRemainingBalance + SendDestroyIfZero,
            body: "Favor Scout Escrow: Refund to Customer".asComment()
        });
    }

    receive("dispute") {
        let ctx: Context = context();
        require(ctx.sender == self.customer || ctx.sender == self.freelancer, "Only participants can dispute");
        require(self.status == 1, "Can only dispute active agreements");
        require(self.deadlineAt > 0 && now() < self.deadlineAt, "Deadline reached");

        self.status = 3;
        self.reply("Dispute registered. Awaiting platform arbitration.".asComment());
    }

    receive(msg: ResolveScoutDispute) {
        let ctx: Context = context();
        require(ctx.sender == self.platform, "Only platform can resolve disputes");
        require(self.status == 3, "Agreement must be disputed");
        require(msg.freelancerPercent <= 100, "Percentage must be between 0 and 100");

        self.status = 2;

        let freelancerAmt: Int = (self.amount * msg.freelancerPercent) / 100;
        let customerAmt: Int = self.amount - freelancerAmt;

        if (customerAmt > 0) {
            send(SendParameters{
                to: self.customer,
                value: customerAmt,
                bounce: false,
                mode: SendPayGasSeparately,
                body: "Favor Scout Escrow: Dispute refund split".asComment()
            });
        }

        if (freelancerAmt > 0) {
            self.distributeFreelancerShare(freelancerAmt, "Favor Scout Escrow: Dispute payout split");
        } else {
            self.refundRemainingGas();
        }
    }

    fun distributeFreelancerShare(freelancerGrossAmount: Int, payoutComment: String) {
        let commission: Int = (freelancerGrossAmount * PLATFORM_COMMISSION_PERCENT) / 100;
        let scoutShare: Int = (commission * self.scoutCommissionSharePercent) / 100;
        let platformShare: Int = commission - scoutShare;
        let freelancerShare: Int = freelancerGrossAmount - commission;

        if (freelancerShare > 0) {
            send(SendParameters{
                to: self.freelancer,
                value: freelancerShare,
                bounce: false,
                mode: SendPayGasSeparately,
                body: payoutComment.asComment()
            });
        }

        if (scoutShare > 0) {
            send(SendParameters{
                to: self.scout,
                value: scoutShare,
                bounce: false,
                mode: SendPayGasSeparately,
                body: "Favor Scout Escrow: Scout Commission".asComment()
            });
        }

        if (platformShare > 0) {
            send(SendParameters{
                to: self.platform,
                value: platformShare,
                bounce: false,
                mode: SendPayGasSeparately,
                body: "Favor Scout Escrow: Platform Commission".asComment()
            });
        }

        self.refundRemainingGas();
    }

    fun refundRemainingGas() {
        send(SendParameters{
            to: self.customer,
            value: 0,
            bounce: false,
            mode: SendRemainingBalance + SendDestroyIfZero,
            body: "Favor Scout Escrow: Gas refund".asComment()
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

    get fun scoutAddress(): Address {
        return self.scout;
    }

    get fun scoutSharePercent(): Int {
        return self.scoutCommissionSharePercent;
    }
}
