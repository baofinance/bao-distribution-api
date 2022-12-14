import fs from 'fs'
import { MerkleTree } from 'merkletreejs'
import { ethers } from 'ethers'
import chalk from 'chalk'
import express, { Request, Response } from 'express'
import cors from 'cors'

const app = express()

var allowedOrigins = [
	'http://localhost:3000',
  'https://app.bao.finance',
  'https://bao.on.fleek.co',
]
app.use(cors({
  origin: (origin: string | undefined, callback: any) => {
    // allow requests with no origin 
    // (like mobile apps or curl requests)
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      var msg = 'The CORS policy for this site does not allow access from the specified origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}))

// -------------------------------
// MERKLE ROOT GENERATION
// -------------------------------

type Account = {
	address: string
	amount: string
}

const _keccakAbiEncode = (a: string, n: string): string => ethers.utils.keccak256(ethers.utils.solidityPack(['address', 'uint256'], [a, n]))

const snapshot: Account[] = JSON.parse(fs.readFileSync(`./snapshot.json`).toString())
const leaves = snapshot.map(account => _keccakAbiEncode(account.address, account.amount))
const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sort: true })
const root = tree.getRoot().toString('hex')
console.log(`${chalk.greenBright('Merkle Root:')} 0x${root}`)
console.log('-------------------------------------------------------------------------------')


app.get('/:address', (req: Request, res: Response) => {
	const { address } = req.params

	const account = snapshot.find(item => {
		return item.address.toLowerCase() === (address as string).toLowerCase()
	})
	if (!account) {
		res.status(404).json({
			error: {
				code: 404,
				message: 'Account not found in merkle proofs snapshot.',
			},
		})
		return
	}

	const leaf = _keccakAbiEncode(account.address, account.amount)
	const proof = tree.getHexProof(leaf)
	if (tree.verify(proof, leaf, root)) {
		res.status(200).json({
			proof,
			...account,
		})
	} else {
		res.status(404).json({
			error: {
				code: 404,
				message: 'Invalid merkle proof.',
			},
		})
	}
})


const port = process.env.PORT || 4000
app.listen(port, () => {
	console.log(`${chalk.greenBright('Serving on port:')} ${port}`)
	console.log('-------------------------------------------------------------------------------')
})

app.set('json spaces', 2)
