import React, { useEffect, useState, useRef } from 'react';
import {
  RiSearchLine,
  RiCloseLine,
  RiArrowLeftLine,
  RiInboxUnarchiveLine,
  RiDeleteBinLine
} from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import buildHeaders from '../config/fetcher';

const BinPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  // Auth check: redirect to login if unauthenticated
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
        }
      } catch (err) {
        sessionStorage.removeItem('user'); sessionStorage.removeItem('token');
        localStorage.removeItem('user'); localStorage.removeItem('token');
        navigate('/login');
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch projects from server
  async function fetchProjects() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects`, { credentials: 'include', headers: buildHeaders() });
      if (!res.ok) throw new Error('Failed to fetch projects');
      const arr = await res.json();
      setProjects(Array.isArray(arr) ? arr.map(p => ({
        _id: p._id,
        name: p.ProjectName || p.name,
        description: p.Description || p.description,
        archived: p.status === 'archived',
        deleted: p.status === 'deleted',
        raw: p,
      })) : []);
    } catch (err) {
      console.error('bin fetch error', err);
      try {
        const raw = sessionStorage.getItem('hg_projects');
        setProjects(raw ? JSON.parse(raw) : []);
      } catch (e) {
        console.warn('sessionStorage read/parse failed', e);
        setProjects([]);
      }
    }
  }

  // Base list of deleted projects
  const deletedList = projects.filter((p) => (
    (p && p.deleted === true) ||
    (p && p.status === 'deleted') ||
    (p && p.raw && p.raw.status === 'deleted')
  ));

  useEffect(() => {
    if (searchInputRef.current && typeof searchInputRef.current.focus === 'function') {
      // do not force-focus by default
    }
  }, []);

  // getOwners helper for search
  const getOwners = (p) => {
    const out = [];
    if (!p) return out;
    try {
      if (p.raw && p.raw.createdBy) {
        const c = p.raw.createdBy;
        if (typeof c === 'object') {
          if (c._id) out.push(String(c._id));
          if (c.username) out.push(String(c.username));
          if (c.email) out.push(String(c.email));
        } else out.push(String(c));
      }
    } catch (e) { /* ignore */ }
    if (p.createdById) out.push(String(p.createdById));
    if (p.owner) out.push(String(p.owner));
    return out.map(String);
  };

  // Search-filtered list
  const filteredDeleted = (() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return deletedList;
    return deletedList.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const desc = String(p.description || '').toLowerCase();
      if (name.includes(q) || desc.includes(q)) return true;
      const owners = getOwners(p).map(s => String(s).toLowerCase());
      if (owners.some(o => o.includes(q))) return true;
      return false;
    });
  })();

  return (
    <div className="min-h-screen bg-brand-bg text-gray-200 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Row 1: Title and Back Button */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-white">Deleted Projects</h1>
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
            <RiArrowLeftLine className="transition-transform duration-300 group-hover:-translate-x-2 text-xl" />
            <span>Back</span>
          </button>
        </div>

        {/* Header Row 2: Search Bar */}
        <div className="relative w-full md:max-w-lg mb-6">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <RiSearchLine className="text-gray-400" />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search bin projects"
            aria-label="Search bin projects"
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
          {deletedList.length === 0 ? (
            <p className="p-6 text-gray-400 bg-surface rounded-lg">No deleted projects.</p>
          ) : filteredDeleted.length === 0 ? (
            <p className="p-6 text-gray-400 bg-surface rounded-lg">No deleted projects match your search.</p>
          ) : (
            <ul className="space-y-4">
              {filteredDeleted.map((project) => (
                <li
                  key={project._id}
                  className="
                    bg-surface rounded-lg shadow-md flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-4
                    transition-transform duration-200 ease-in-out hover:scale-[1.02] 
                  "
                >
                  <div className="flex-1">
                    <h3>
                      <button
                        className="text-xl font-semibold text-white hover:text-cyan transition-colors"
                        onClick={() => navigate(`/projects/${project._id}`)}
                      >
                        {project.name}
                      </button>
                    </h3>
                    <p className="text-gray-400 mt-1 text-sm">{project.description}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-shrink-0 w-full md:w-auto">
                    <button
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-cyan text-brand-bg font-semibold py-2 px-4 rounded-lg hover:bg-cyan-dark transition-colors"
                      onClick={async () => {
                        try {
                          const r = await fetch(`${API_BASE_URL}/api/projects/${project._id}/restore-deleted`, { method: 'PATCH', credentials: 'include', headers: buildHeaders() });
                          if (r.ok) {
                            await fetchProjects(); // Refresh list
                          } else {
                            const body = await r.text().catch(() => '');
                            alert('Restore failed: ' + r.status + ' ' + body);
                          }
                        } catch (err) { console.error(err); alert('Restore error'); }
                      }}
                    >
                      <RiInboxUnarchiveLine />
                      Restore
                    </button>
                    <button
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                      onClick={async () => {
                        if (!globalThis.confirm('Permanently delete this project? This cannot be undone.')) return;
                        try {
                          const r = await fetch(`${API_BASE_URL}/api/projects/${project._id}/permanent`, { method: 'DELETE', credentials: 'include', headers: buildHeaders() });
                          if (r.ok) {
                            await fetchProjects(); // Refresh list
                          } else {
                            const body = await r.text().catch(() => '');
                            alert('Permanent delete failed: ' + r.status + ' ' + body);
                          }
                        } catch (err) { console.error(err); alert('Permanent delete error'); }
                      }}
                    >
                      <RiDeleteBinLine />
                      Delete Permanently
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

export default BinPage;