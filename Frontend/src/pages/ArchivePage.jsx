import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  RiArrowLeftLine, RiInboxUnarchiveLine, RiDeleteBinLine, 
  RiSearchLine, RiCloseLine 
} from 'react-icons/ri';
import API_BASE_URL from '../config/api';
import buildHeaders from '../config/fetcher';

const ArchivePage = () => {
  // --- All state and logic is preserved ---
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const [profileUser, setProfileUser] = useState(null);

  // Auth check
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/data`, { method: 'GET', credentials: 'include', headers: buildHeaders() });
        const json = await res.json();
        if (!mounted) return;
        if (!json || !json.success || !json.userData) {
          sessionStorage.removeItem('user'); sessionStorage.removeItem('token');
          localStorage.removeItem('user'); localStorage.removeItem('token');
          navigate('/login'); 
        } else {
          setProfileUser(json.userData);
        }
      } catch (err) {
        sessionStorage.removeItem('user'); sessionStorage.removeItem('token');
        localStorage.removeItem('user'); localStorage.removeItem('token');
        navigate('/login');
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/projects`, { credentials: 'include', headers: buildHeaders() });
        if (!res.ok) throw new Error('Failed');
        const arr = await res.json();
        setProjects(Array.isArray(arr) ? arr.map(p => ({
          _id: p._id,
          name: p.ProjectName || p.name,
          description: p.Description || p.description,
          archived: p.status === 'archived',
          deleted: p.status === 'deleted',
          createdById: p.createdBy && (p.createdBy._id || p.createdBy),
          owner: (p.createdBy && (p.createdBy.username || p.createdBy._id)) || p.owner || null,
        })) : []);
      } catch (err) {
        console.error('archive fetch error', err);
        try { const raw = sessionStorage.getItem('hg_projects'); setProjects(raw ? JSON.parse(raw) : []); } catch (e) { setProjects([]); }
      }
    };
    fetchProjects();
  }, []);

  // Project owner helpers
  const getProjectOwners = (p) => {
    const out = new Set();
    if (!p) return out;
    const pushVal = (v) => {
      if (!v && v !== 0) return;
      if (typeof v === 'string' || typeof v === 'number') out.add(String(v));
      else if (typeof v === 'object') {
        if (v._id) out.add(String(v._id));
        if (v.username) out.add(String(v.username));
        if (v.email) out.add(String(v.email));
      }
    };
    pushVal(p.createdById);
    pushVal(p.owner);
    if (p.raw && p.raw.createdBy) pushVal(p.raw.createdBy);
    return out;
  };

  const canRestore = (project) => {
    if (!profileUser || !project) {
      return false;
    }
    const userIds = [profileUser._id, profileUser.username, profileUser.email].filter(Boolean).map(String);
    const owners = Array.from(getProjectOwners(project));
    const result = userIds.some((u) => owners.includes(u));
    return result;
  };

  // Base list of archived projects
  const archivedList = projects
    .map((p, idx) => ({ ...p, _idx: idx }))
    .filter((p) => p.archived && !p.deleted);

  // Filtering logic
  const filteredArchived = (() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return archivedList;
    return archivedList.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const desc = String(p.description || '').toLowerCase();
      if (name.includes(q) || desc.includes(q)) return true;
      const owners = Array.from(getProjectOwners(p)).map(String).map(s => s.toLowerCase());
      if (owners.some(o => o.includes(q))) return true;
      return false;
    });
  })();

  return (
    <div className="min-h-screen bg-brand-bg text-gray-200 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Row 1: Title and Back Button */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-white">Archived Projects</h1>
          <button
            onClick={() => navigate(-1)}
            className="
              group flex items-center justify-center gap-2 
              border border-cyan text-cyan font-semibold 
              py-2 px-5 rounded-lg 
              hover:bg-cyan hover:text-brand-bg 
              transition-all duration-300 
              w-full md:w-auto flex-shrink-0
            "
          >
            <RiArrowLeftLine className="transition-transform duration-300 group-hover:-translate-x-1" />
            <span>Back</span>
          </button>
        </div>

        {/* --- THIS SECTION is now identical to BinPage --- */}
        <div className="relative w-full md:max-w-lg mb-6">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <RiSearchLine className="text-gray-400" />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search archived projects"
            aria-label="Search archived projects"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-full pl-10 pr-10 py-2 rounded-lg 
              bg-surface border border-gray-600 
              text-white placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-cyan
            "
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              className="absolute inset-y-0 right-0 flex items-center pr-3"
            >
              <RiCloseLine className="text-gray-400 hover:text-white" />
            </button>
          )}
        </div>

        {/* Project List */}
        <div>
          {archivedList.length === 0 ? (
             <p className="p-6 text-gray-400 bg-surface rounded-lg">No archived projects.</p>
          ) : filteredArchived.length === 0 ? (
            <p className="p-6 text-gray-400 bg-surface rounded-lg">No archived projects match your search.</p>
          ) : (
            <ul className="space-y-4">
              {filteredArchived.map((project) => (
                <li 
                  key={project._idx} 
                  className="
                    bg-surface rounded-lg shadow-md flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-4
                    transition-transform duration-200 ease-in-out hover:scale-[1.02]
                  "
                >
                  <div className="flex-1">
                    <h3>
                      <button
                        className="text-xl font-semibold text-white hover:text-cyan transition-colors"
                        onClick={() => navigate(`/projects/${project._id || project._idx}`)}
                      >
                        {project.name}
                      </button>
                    </h3>
                    <p className="text-gray-400 mt-1 text-sm">{project.description}</p>
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0 w-full md:w-auto">
                    {canRestore(project) ? (
                      <button
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-cyan text-brand-bg font-semibold py-2 px-4 rounded-lg hover:bg-cyan-dark transition-colors"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            const id = project._id;
                            if (!id) {
                              alert('Cannot restore: missing project id');
                              return;
                            }
                            const r = await fetch(`${API_BASE_URL}/api/projects/${id}/restore`, {
                              method: 'PATCH',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json', ...buildHeaders() },
                              body: JSON.stringify({}),
                            });
                            if (r.ok) {
                              alert('Project restored');
                              window.location.reload(); // Simple refresh to update list
                            } else {
                              let body = await r.text().catch(() => '');
                              console.error('Restore failed', r.status, body);
                              alert('Restore failed: ' + r.status + ' ' + body);
                            }
                          } catch (err) {
                            console.error('Restore error', err);
                            alert('Restore error - see console');
                          }
                        }}
                      >
                        <RiInboxUnarchiveLine />
                        Restore
                      </button>
                    ) : (
                      <button
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-surface-light text-gray-500 font-semibold py-2 px-4 rounded-lg cursor-not-allowed"
                        disabled
                        title="Only project owner or creator can restore"
                      >
                        <RiInboxUnarchiveLine />
                        Restore
                      </button>
                    )}
                    <button
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                      onClick={async () => {
                        try {
                          const r = await fetch(`${API_BASE_URL}/api/projects/${project._id}`, { method: 'DELETE', credentials: 'include', headers: buildHeaders() });
                          if (r.ok) {
                            alert('Moved to Bin');
                            // Refetch projects to update UI
                            const res2 = await fetch(`${API_BASE_URL}/api/projects`, { credentials: 'include', headers: buildHeaders() });
                            if (res2.ok) {
                              const arr = await res2.json();
                              setProjects(Array.isArray(arr) ? arr.map(p => ({
                                _id: p._id,
                                name: p.ProjectName || p.name,
                                description: p.Description || p.description,
                                archived: p.status === 'archived',
                                deleted: p.status === 'deleted',
                                createdById: p.createdBy && (p.createdBy._id || p.createdBy),
                              })) : []);
                            }
                          } else {
                            const body = await r.text().catch(() => '');
                            console.error('Move to bin failed', r.status, body);
                            alert('Move to bin failed: ' + r.status + ' ' + body);
                          }
                        } catch (err) { console.error('Move to bin error', err); alert('Move to bin error'); }
                      }}
                    >
                      <RiDeleteBinLine />
                      Move to Bin
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchivePage;