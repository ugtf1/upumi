# UPUMI Website

# Database structure

Tables
users
generalFinance
attendance
hostingSchedule
dues
collections
transactions
expenses 
memberFinance

the user table have the following fields:
	user_id 
	phone 
	role (choice: Admin, Member)
	email 
	fName 
	lName 
	dateJoined 
	voteRole (choice: Yes, No)
	address
	monthlyDues
	totalPaid
	outstanding
	status (choice: Active, Inactive)

the generalFinance table have the following fields:
	totalMembers (data collected from the sum total of users on the database)
	activeMembers (data collected from total active users)
	totalRevenue (total payments made from dues)
	pendingPayments (sum of all dues yet to be paid as at the current month)
	incomeYtd (total payment for the year minus Expenses for the year)
	expensesYtd (total expense transaction for the year)
	bussinessAccount
	fundraiserAccount
	totalAccBalance

the attendance table have these fields. the admin can select the year, month, and from textarea showing the names of all members, the admin can add and remove member name to and from the userIn field:
	year
	month
	usersIn

the hostingSchedule table have the following fields the admin can select the year, month, and from textarea showing the names of all members, the admin can add and remove member name to and from the hostMember field:
	year
	month
	hostMember

the dues table records dues payment for every user. so when the admin is adding dues payment he must select the particular user name he is registering the dues payment under, then select year, month, and then input amount

the collections table have the following fields:
	event
	amountPaid

the transaction table have the following fields:
	fullName (when the admin click to add name, a dropdown of all users should appear for the admin to select name)
	title (choice: Raffle, Insurance, Wrapper, UPUA 25 Raffle, Levy)
	amount
	date

the expenses table have the following fields:
	reason
	title
	amount
	date

memberFinance table have the following fields:
	monthlyDues (fixed amount to be paid monthly)
	totalPaid (total amount of dues paid)
	outstanding (total of dues not paid as at current month)

Official website for UPU MI.
