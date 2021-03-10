import React, { useContext, useEffect, useState } from "react"
import { Context } from "../../context"
import queryString from 'query-string';
import {getRewards, getDaoContract, 
    updateWalletData, BNB_ADDR, SPARTA_ADDR,
    getMemberDetail, getTotalWeight, getGasPrice, getBNBBalance,
} from "../../client/web3"
import Notification from '../Common/notification'

import { bn, one, formatBN, convertFromWei, convertToWei, formatAllUnits, formatGranularUnits, daysSince, hoursSince } from '../../utils'

import {
    Row, Col, InputGroup, InputGroupAddon, Label, UncontrolledTooltip,
    FormGroup, Card, CardTitle, Table, CardSubtitle, CardBody,Container,
    Spinner, Input, Modal, ModalHeader, ModalBody, ModalFooter, Button, Progress
} from "reactstrap"
import { makeStyles } from '@material-ui/core/styles';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import StepContent from '@material-ui/core/StepContent';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

import { withNamespaces } from 'react-i18next'
import { withRouter, Link } from "react-router-dom"
import EarnTableItem from "./EarnTableItem"

const UpgradeComponent = (props) => {

    const context = useContext(Context)
    const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms))

    function getSteps() {
        return [<CardTitle className="mt-2"><h4>DAO Migration</h4></CardTitle>, <CardTitle className="mt-2"><h4>Pool Liquidity Migration</h4></CardTitle>, <CardTitle className="mt-2"><h4>Bonded Assets Migration</h4></CardTitle>];
    }
  
    const [reward, setReward] = useState(0)
    const [member, setMember] = useState([])
    const [totalWeight, setTotalWeight] = useState(0)
    const [notifyMessage, setNotifyMessage] = useState("")
    const [notifyType, setNotifyType] = useState("dark")
    const [loadingHarvest, setLoadingHarvest] = useState(false)
    const [lastHarvest,setlastHarvest] = useState('100')

    useEffect(() => {
        const interval = setInterval(() => {
            if (context.account && context.walletData) {
                getData()
            }
        }, 3000);
        return () => clearInterval(interval)
        // eslint-disable-next-line
    }, [context.walletData, context.account])

    const getData = async () => {
        let data = await Promise.all([getRewards(context.account), getMemberDetail(context.account), getTotalWeight()])
        let rewards = data[0]
        let memberDetails = data[1]
        let weight = data[2]
        setReward(rewards)
        setMember(memberDetails)
        setTotalWeight(weight)
        setlastHarvest(hoursSince(memberDetails.lastBlock))
    }

    const harvest = async () => {
        setNotifyMessage('...')
        setLoadingHarvest(true)
        let gasFee = 0
        let gasLimit = 0
        let contTxn = false
        const estGasPrice = await getGasPrice()
        let contract = getDaoContract()
        console.log('Estimating gas', estGasPrice)
        await contract.methods.harvest().estimateGas({
            from: context.account,
            gasPrice: estGasPrice,
        }, function(error, gasAmount) {
            if (error) {
                console.log(error)
                setNotifyMessage('Transaction error, do you have enough BNB for gas fee?')
                setNotifyType('warning')
                setLoadingHarvest(false)
            }
            gasLimit = (Math.floor(gasAmount * 1.5)).toFixed(0)
            gasFee = (bn(gasLimit).times(bn(estGasPrice))).toFixed(0)
        })
        let enoughBNB = true
        var gasBalance = await getBNBBalance(context.account)
        if (bn(gasBalance).comparedTo(bn(gasFee)) === -1) {
            enoughBNB = false
            setNotifyMessage('You do not have enough BNB for gas fee!')
            setNotifyType('warning')
            setLoadingHarvest(false)
        }
        else if (enoughBNB === true) {
            console.log('Harvesting SPARTA', estGasPrice, gasLimit, gasFee)
            await contract.methods.harvest().send({
                from: context.account,
                gasPrice: estGasPrice,
                gas: gasLimit,
            }, function(error, transactionHash) {
                if (error) {
                    console.log(error)
                    setNotifyMessage('Transaction cancelled')
                    setNotifyType('warning')
                    setLoadingHarvest(false)
                }
                else {
                    console.log('txn:', transactionHash)
                    setNotifyMessage('Harvest Pending...')
                    setNotifyType('success')
                    contTxn = true
                }
            })
            if (contTxn === true) {
                setNotifyMessage('Harvested SPARTA!')
                setNotifyType('success')
                setLoadingHarvest(false)
            }
        }
        await refreshData()
    }

    const refreshData = async () => {
        if (context.walletDataLoading !== true) {
            // Refresh BNB & SPARTA balance
            context.setContext({'walletDataLoading': true})
            let walletData = await updateWalletData(context.account, context.walletData, BNB_ADDR)
            walletData = await updateWalletData(context.account, walletData, SPARTA_ADDR)
            context.setContext({'walletData': walletData})
            context.setContext({'walletDataLoading': false})
        }
        // Notification to show txn complete
        setNotifyMessage('Transaction Sent!')
        setNotifyType('success')
    }

    function getStepContent(step) {
        switch (step) {
            case 0:
                return  context.sharesData &&
                    <div className="table-responsive">
                        
                        <CardSubtitle className="mb-3">
                            Unlock your DAO weighting to join the new DAO Sheild Wall<br/>
                            
                        </CardSubtitle>
                        <Table className="table-centered mb-0">

                            <thead className="center">
                            <tr>
                                <th className="d-none d-lg-table-cell" scope="col">{props.t("Icon")}</th>
                                <th className="d-none d-lg-table-cell" scope="col">{props.t("Locked")}</th>
                                <th scope="col">{props.t("Action")}</th>
                            </tr>
                            </thead>
                            <tbody>
                                {context.sharesData.filter(x => x.units + x.locked > 0).sort((a, b) => (parseFloat(a.units + a.locked) > parseFloat(b.units + b.locked)) ? -1 : 1).map(c =>
                                    <EarnTableItem 
                                        key={c.address}
                                        symbAddr={c.address}
                                        address={c.poolAddress}
                                        symbol={c.symbol}
                                        units={c.units}
                                        locked={c.locked}
                                        member={member}
                                        harvest={harvest}
                                        loadingHarvest={loadingHarvest}
                                        lastHarvest={lastHarvest}
                                    />
                                )}
                                <tr>
                                    <td colSpan="5">
                                        {context.sharesDataLoading !== true && context.sharesDataComplete === true && context.sharesData.filter(x => x.units + x.locked > 0).length > 0 &&
                                            <div className="text-center m-2">All Locked LP Tokens Loaded</div>
                                        }
                                    </td>
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                
        ;
            case 1:
                return 'Migrate your liquidity';
            case 2:
                return `Migrate your bonded lps`;
        }
    }

    const [activeStep, setActiveStep] = React.useState(0);
    const steps = getSteps();

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleReset = () => {
        setActiveStep(0);
    };

    return (
        <>
            <Card >
                <Row >
                     <Col sm={12} className="mr-20">
                                <div>
                                    <h1 className="text-center m-2 ">Spartan Protocol Migration</h1>
                                    
                                    <Stepper className ="m-2"activeStep={activeStep} orientation="vertical">
                                        {steps.map((label, index) => (
                                            <Step key={label}>
                                                <StepLabel>{label}</StepLabel>
                                                <StepContent>
                                                    <Typography>{getStepContent(index)}</Typography>
                                                    <div className="m-2">
                                                        <div>
                                                            <Button
                                                                hidden={activeStep === 0}
                                                                onClick={handleBack}
                                                                className={"m-2"}
                                                            > Back </Button>
                                                            <Button
                                                                variant="contained"
                                                                color="primary"
                                                                onClick={handleNext}
                                                                className={"m-2"}
                                                            >
                                                                {activeStep === steps.length - 1 ? 'Finish' : 'Complete Step'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </StepContent>
                                            </Step>
                                        ))}
                                    </Stepper>
                                    {activeStep === steps.length && (
                                        <Paper square elevation={0} className="p-3">
                                            <Typography>All steps completed - you&apos;re finished :P</Typography>
                                            <Button onClick={'/'} color="primary" className={"m-2"}>
                                               Lets Go - DappV2!
                                          </Button>
                                        </Paper>
                                    )}
                                </div>
                        
                     
                    </Col>
                </Row>
            </Card>
      
        </>
    )
};

export default withRouter(withNamespaces()(UpgradeComponent));
