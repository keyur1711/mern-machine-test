import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("agents");
  const [agents, setAgents] = useState([]);
  const [distributedLists, setDistributedLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [agentForm, setAgentForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
  });

  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    loadAgents();
    loadDistributedLists();
  }, [navigate]);

  const loadAgents = async () => {
    try {
      const response = await api.get("/agents");
      setAgents(response.data);
    } catch (error) {
      console.error("Error loading agents:", error);
      showMessage("error", "Failed to load agents");
    }
  };

  const loadDistributedLists = async () => {
    try {
      const response = await api.get("/lists/distributed");
      setDistributedLists(response.data.distributedLists || []);
    } catch (error) {
      console.error("Error loading distributed lists:", error);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleAgentFormChange = (e) => {
    setAgentForm({
      ...agentForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      await api.post("/agents", agentForm);
      showMessage("success", "Agent created successfully");
      setAgentForm({ name: "", email: "", mobile: "", password: "" });
      loadAgents();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message || "Failed to create agent",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (["csv", "xlsx", "xls"].includes(ext)) {
        setSelectedFile(file);
        setMessage({ type: "", text: "" });
      } else {
        showMessage("error", "Only CSV, XLSX, and XLS files are allowed");
        e.target.value = "";
      }
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showMessage("error", "Please select a file");
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      await api.post("/lists/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      showMessage("success", "File uploaded and distributed successfully");
      setSelectedFile(null);
      e.target.reset();
      loadDistributedLists();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message || "Failed to upload file",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-secondary">
          Logout
        </button>
      </header>

      <div className="container">
        {message.text && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "agents" ? "active" : ""}`}
            onClick={() => setActiveTab("agents")}
          >
            Agents
          </button>
          <button
            className={`tab ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            Upload CSV
          </button>
          <button
            className={`tab ${activeTab === "lists" ? "active" : ""}`}
            onClick={() => setActiveTab("lists")}
          >
            Distributed Lists
          </button>
        </div>
        {activeTab === "agents" && (
          <div>
            <div className="card">
              <h3>Add New Agent</h3>
              <form onSubmit={handleCreateAgent}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      name="name"
                      value={agentForm.name}
                      onChange={handleAgentFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={agentForm.email}
                      onChange={handleAgentFormChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Mobile Number (with country code)</label>
                    <input
                      type="text"
                      name="mobile"
                      value={agentForm.mobile}
                      onChange={handleAgentFormChange}
                      placeholder="+1234567890"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      name="password"
                      value={agentForm.password}
                      onChange={handleAgentFormChange}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Agent"}
                </button>
              </form>
            </div>

            <div className="card">
              <h3>All Agents ({agents.length})</h3>
              {agents.length === 0 ? (
                <p>No agents created yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent._id}>
                        <td>{agent.name}</td>
                        <td>{agent.email}</td>
                        <td>{agent.mobile}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {activeTab === "upload" && (
          <div className="card">
            <h3>Upload CSV/XLSX File</h3>
            <p className="info-text">
              Upload a CSV or Excel file with columns: FirstName, Phone, Notes
            </p>
            <form onSubmit={handleFileUpload}>
              <div className="form-group">
                <label>Select File (CSV, XLSX, or XLS)</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  required
                />
              </div>
              {selectedFile && (
                <p className="success">Selected: {selectedFile.name}</p>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !selectedFile}
              >
                {loading ? "Uploading..." : "Upload and Distribute"}
              </button>
            </form>
          </div>
        )}

        {activeTab === "lists" && (
          <div>
            {distributedLists.length === 0 ? (
              <div className="card">
                <p>
                  No distributed lists yet. Upload a CSV file to distribute
                  items among agents.
                </p>
              </div>
            ) : (
              distributedLists.map((group, index) => (
                <div key={index} className="card">
                  <h3>
                    Agent: {group.agent.name} ({group.items.length} items)
                  </h3>
                  <p>
                    <strong>Email:</strong> {group.agent.email}
                  </p>
                  <p>
                    <strong>Mobile:</strong> {group.agent.mobile}
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>First Name</th>
                        <th>Phone</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.firstName}</td>
                          <td>{item.phone}</td>
                          <td>{item.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
