import "@stdlib/deploy";

const PLATFORM_COMMISSION_PERCENT: Int = 5;
const STORAGE_RESERVE: Int = 50000000;

// Message structure for resolving disputes
message ResolveDispute {
    freelancerPercent: Int as uint8; // Percentage (0-100) to distribute to the freelancer
}

contract FavorEscrow with Deployable {
    // Immutable Parameters
    arbitrator: Address;         // Official platform wallet (e.g. UQACxv...)
    customer: Address;           // Wallet of the Customer (Locks the funds)
    freelancer: Address;         // Wallet of the Freelancer (Executes the work)
    dealId: Int as uint64;       // Unique Postgres database Deal ID
    deadlineDurationSeconds: Int as uint32;
    
    // State variables
    amount: Int as coins;        // Total locked amount in GRAM
    status: Int as uint8;        // 0 = Awaiting Deposit, 1 = Locked/In-Progress, 2 = Completed, 3 = Disputed, 4 = Refunded
    deadlineAt: Int as uint64;

    init(
        arbitrator: Address,
        customer: Address,
        freelancer: Address,
        dealId: Int,
        expectedAmount: Int,
        deadlineDurationSeconds: Int
    ) {
        self.arbitrator = arbitrator;
        self.customer = customer;
        self.freelancer = freelancer;
        self.dealId = dealId;
        require(expectedAmount > 0, "Expected amount must be positive");
        require(deadlineDurationSeconds > 0, "Deadline duration must be positive");
        self.amount = expectedAmount;
        self.deadlineDurationSeconds = deadlineDurationSeconds;
        self.status = 0; // Awaiting Deposit
        self.deadlineAt = 0;
    }

    // Handles the deployment and initial deposit in one single transaction
    receive() {
        let ctx: Context = context();
        require(self.status == 0, "Already deposited");
        require(ctx.sender == self.customer, "Only the customer can deploy and deposit");
        require(ctx.value >= self.amount + STORAGE_RESERVE, "Deposit is below expected amount plus reserve");
        self.status = 1; // Locked/In-Progress
        self.deadlineAt = now() + self.deadlineDurationSeconds;
    }

    // Normal Flow: Customer confirms successful completion and releases funds
    receive("complete") {
        let ctx: Context = context();
        // Allow either the customer to release, or arbitrator to override and complete
        require(ctx.sender == self.customer || ctx.sender == self.arbitrator, "Not authorized");
        require(self.status == 1 || self.status == 3, "Invalid escrow status");

        self.status = 2; // Completed

        // 5% Platform Fee Commission
        let commission: Int = (self.amount * PLATFORM_COMMISSION_PERCENT) / 100;
        let freelancerShare: Int = self.amount - commission;

        // Disburse 95% to the Freelancer
        send(SendParameters{
            to: self.freelancer,
            value: freelancerShare,
            bounce: false,
            mode: SendPayGasSeparately,
            body: "Favor Escrow: Payout".asComment()
        });

        // Disburse exactly 5% to the platform administrator.
        send(SendParameters{
            to: self.arbitrator,
            value: commission,
            bounce: false,
            mode: SendPayGasSeparately,
            body: "Favor Escrow: 5% Commission".asComment()
        });

        self.refundRemainingGas();
    }

    // Refund Flow: Freelancer voluntarily cancels or refunds the customer
    receive("refund") {
        let ctx: Context = context();
        require(self.status == 1 || self.status == 3, "Invalid escrow status");

        // Freelancer/platform refunds remain voluntary; the customer may refund after the funded deadline.
        if (ctx.sender == self.customer) {
            require(self.status == 1, "Customer deadline refund requires an active escrow");
            require(
                self.deadlineAt > 0 && now() >= self.deadlineAt,
                "Deadline not reached"
            );
        } else {
            require(
                ctx.sender == self.freelancer || ctx.sender == self.arbitrator,
                "Not authorized"
            );
        }

        self.status = 4; // Refunded

        // Refund 100% of funds back to the Customer and destroy the contract
        send(SendParameters{
            to: self.customer,
            value: 0,
            bounce: false,
            mode: SendRemainingBalance + SendDestroyIfZero,
            body: "Favor Escrow: Refund to Customer".asComment()
        });
    }

    // Dispute Freeze: Either party freezes the contract, waiting for platform arbitration
    receive("dispute") {
        let ctx: Context = context();
        require(ctx.sender == self.customer || ctx.sender == self.freelancer, "Only deal participants can raise a dispute");
        require(self.status == 1, "Can only dispute active agreements");
        require(self.deadlineAt > 0 && now() < self.deadlineAt, "Deadline reached");

        self.status = 3; // Disputed
        
        self.reply("Dispute registered. Awaiting platform arbitration.".asComment());
    }

    // Arbitration Resolution: Arbitrator decides the split based on evidence
    receive(msg: ResolveDispute) {
        let ctx: Context = context();
        require(ctx.sender == self.arbitrator, "Only the platform arbitrator can resolve disputes");
        require(self.status == 3, "Agreement must be in disputed state");
        require(msg.freelancerPercent <= 100, "Percentage must be between 0 and 100");

        self.status = 2; // Resolved/Completed

        let freelancerAmt: Int = (self.amount * msg.freelancerPercent) / 100;
        let customerAmt: Int = self.amount - freelancerAmt;

        // Calculate and extract 5% platform commission on the portion allocated to the freelancer
        let commission: Int = 0;
        let netFreelancerAmt: Int = freelancerAmt;
        if (freelancerAmt > 0) {
            commission = (freelancerAmt * PLATFORM_COMMISSION_PERCENT) / 100;
            netFreelancerAmt = freelancerAmt - commission;
        }

        // Send customer refund split
        if (customerAmt > 0) {
            send(SendParameters{
                to: self.customer,
                value: customerAmt,
                bounce: false,
                mode: SendPayGasSeparately,
                body: "Favor Escrow: Dispute refund split".asComment()
            });
        }

        // Send freelancer payout split
        if (netFreelancerAmt > 0) {
            send(SendParameters{
                to: self.freelancer,
                value: netFreelancerAmt,
                bounce: false,
                mode: SendPayGasSeparately,
                body: "Favor Escrow: Dispute payout split".asComment()
            });
        }

        if (commission > 0) {
            send(SendParameters{
                to: self.arbitrator,
                value: commission,
                bounce: false,
                mode: SendPayGasSeparately,
                body: "Favor Escrow: Dispute Resolution Fee".asComment()
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
            body: "Favor Escrow: Gas refund".asComment()
        });
    }

    // Read-only getters for DApps and verification
    get fun status(): Int {
        return self.status;
    }

    get fun deadlineAt(): Int {
        return self.deadlineAt;
    }

    get fun details(): Address {
        return myAddress();
    }
}
