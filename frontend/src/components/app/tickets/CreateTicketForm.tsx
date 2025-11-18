
import { useState, useContext, useEffect } from 'react';
import { Avatar, Button, Dropdown, Label, TextInput } from 'flowbite-react';
import { isValid, format } from 'date-fns';
import { useNavigate } from "react-router";
import { TicketType } from 'src/types/apps/ticket';
import { TicketContext } from 'src/context/TicketContext';
import user10 from '/src/assets/images/profile/user-10.jpg';
import user2 from '/src/assets/images/profile/user-2.jpg';
import user3 from '/src/assets/images/profile/user-3.jpg';
import user8 from '/src/assets/images/profile/user-8.jpg';



const agents = [
    { id: 1, name: 'Liam', photo: user10 },
    { id: 2, name: 'Steve', photo: user2 },
    { id: 3, name: 'Jack', photo: user3 },
    { id: 4, name: 'John', photo: user8 }
];

const CreateTicketForm = () => {
    const { tickets, addTicket } = useContext(TicketContext);
    const [ticketId, setTicketId] = useState<number | undefined>(undefined);
    const [ticketDate, setTicketDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [ticketTitle, setTicketTitle] = useState('');
    const [ticketDescription, setTicketDescription] = useState('');
    const [selectedAgent, setSelectedAgent] = useState(agents[0]);
    const [agentPhoto, setAgentPhoto] = useState(agents[0].photo);

    const navigate = useNavigate();

    useEffect(() => {
        // Find the maximum ID in the existing tickets
        const maxId = tickets.reduce((max, ticket) => ticket.Id > max ? ticket.Id : max, 0);
        // Set the new ticket ID
        setTicketId(maxId + 1);
    }, [tickets]);

    const handleSubmit = () => {
        if (!ticketTitle || !ticketDescription) {
            alert('Please fill out all fields.');
            return;
        }

        const newTicket: TicketType = {
            Id: ticketId!,
            ticketTitle,
            ticketDescription,
            Status: 'Open',
            Label: 'primary',
            thumb: agentPhoto,
            AgentName: selectedAgent.name,
            Date: new Date(ticketDate),
            deleted: false,
        };

        addTicket(newTicket);
        resetForm();
        navigate('/apps/tickets');
    };

    const resetForm = () => {
        setTicketId(undefined);
        setTicketDate(new Date().toISOString().split('T')[0]);
        setTicketTitle('');
        setTicketDescription('');
        setSelectedAgent(agents[0]);
        setAgentPhoto(agents[0].photo);
    };
    const parsedDate = isValid(new Date(ticketDate)) ? new Date(ticketDate) : new Date();
    const formattedOrderDate = format(parsedDate, "EEEE, MMMM dd, yyyy");

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Create New Ticket</h2>
            <p>  ID : {ticketId !== undefined ? ticketId : ''}</p>
            <p>Date : {formattedOrderDate}</p>
            <div className="bg-lightgray dark:bg-gray-800/70 p-6 my-6 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="mb-4">
                        <div className="mb-2 block">
                            <Label htmlFor="ticketTitle" value="Ticket Title" />
                        </div>
                        <TextInput
                            id="ticketTitle"
                            value={ticketTitle}
                            onChange={(e) => setTicketTitle(e.target.value)}
                            placeholder="Ticket Title"
                            className="w-full"
                        />
                    </div>
                    <div className="mb-4">
                        <div className="mb-2 block">
                            <Label htmlFor="ticketDescription" value="Ticket Description" />
                        </div>
                        <TextInput
                            id="ticketDescription"
                            value={ticketDescription}
                            onChange={(e) => setTicketDescription(e.target.value)}
                            placeholder="Ticket Description"
                            className="w-full"
                        />
                    </div>

                    <div className="mb-4">
                        <Dropdown label={selectedAgent.name} className=' className="w-full p-2 border border-gray-300 rounded-md"'>
                            {agents.map(agent => (
                                <Dropdown.Item key={agent.id} onClick={() => {
                                    setSelectedAgent(agent);
                                    setAgentPhoto(agent.photo);

                                }}>
                                    <div className="flex items-center gap-2">
                                        <Avatar img={agent.photo} alt={agent.name} rounded />
                                        <span>{agent.name}</span>
                                    </div>
                                </Dropdown.Item>
                            ))}
                        </Dropdown>
                    </div>
                    <div className="flex justify-end gap-3 mt-2">
                        <Button color={"primary"} onClick={handleSubmit} className=" hover:bg-lightprimary hover:text-primary  mt-6">
                            Save
                        </Button>
                        <Button color={"error"} className="mt-6" onClick={() => { navigate('/apps/tickets'); }}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default CreateTicketForm;
