import './AdminPage.scss';
import { useState } from 'react';
import AdminHeader from './AdminHeader/AdminHeader';
import AdminTabs from './AdminTabs/AdminTabs';
import ProcessingServersTab from './ProcessingServersTab/ProcessingServersTab';
import UserManagementTab from './UserManagementTab/UserManagementTab';
import ProcessingProcessesTab from './ProcessingProcessesTab/ProcessingProcessesTab';
import type { Tab } from './shared/types';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div className="admin-page" data-testid="admin-page">
      <div className="admin-inner">
        <AdminHeader />
        <AdminTabs tab={tab} onChange={setTab} />

        <div className="admin-content">
          {tab === 'users'       && <UserManagementTab />}
          {tab === 'servers'     && <ProcessingServersTab />}
          {tab === 'processing'  && <ProcessingProcessesTab />}
        </div>
      </div>
    </div>
  );
}
