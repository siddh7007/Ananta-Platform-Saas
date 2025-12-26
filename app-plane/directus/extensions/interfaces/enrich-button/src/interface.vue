<template>
  <div class="enrich-button-interface">
    <div class="button-container">
      <v-button
        @click="enrichComponent"
        :loading="loading"
        :disabled="!canEnrich || loading"
        icon="sync"
        :class="{ 'pulse-animation': shouldPulse }"
      >
        {{ buttonLabel }}
      </v-button>

      <v-chip
        v-if="lastResult && showBadge"
        :class="getStatusClass(lastResult.status)"
        small
        outlined
      >
        {{ getStatusLabel(lastResult.status) }}
      </v-chip>
    </div>

    <div v-if="lastResult" class="result-display">
      <div class="quality-indicator">
        <v-progress-circular
          :model-value="lastResult.quality_score"
          :color="getScoreColor(lastResult.quality_score)"
          show-value
        >
          {{ lastResult.quality_score }}%
        </v-progress-circular>
        <span class="quality-label">Quality Score</span>
      </div>

      <div class="enrichment-details">
        <v-chip
          v-for="source in lastResult.sources_successful"
          :key="source"
          small
          class="source-chip"
        >
          <v-icon name="check" small />
          {{ source }}
        </v-chip>

        <div v-if="lastResult.enriched_fields?.length > 0" class="enriched-fields">
          <span class="label">Enriched Fields:</span>
          <span class="count">{{ lastResult.enriched_fields.length }}</span>
        </div>

        <div v-if="lastResult.missing_fields?.length > 0" class="missing-fields">
          <span class="label">Missing:</span>
          <span class="count">{{ lastResult.missing_fields.length }}</span>
        </div>
      </div>

      <div v-if="lastResult.issues?.length > 0" class="issues-list">
        <v-notice type="warning">
          <ul>
            <li v-for="(issue, index) in lastResult.issues" :key="index">
              {{ issue }}
            </li>
          </ul>
        </v-notice>
      </div>
    </div>

    <div v-if="options.show_history && enrichmentHistory.length > 0" class="history-section">
      <h3>Enrichment History</h3>
      <v-table
        :headers="historyHeaders"
        :items="enrichmentHistory"
        :loading="loadingHistory"
        :rows-per-page="5"
      >
        <template #item.timestamp="{ item }">
          {{ formatDate(item.timestamp) }}
        </template>
        <template #item.quality_score="{ item }">
          <v-chip :color="getScoreColor(item.quality_score)" small>
            {{ item.quality_score }}%
          </v-chip>
        </template>
        <template #item.status="{ item }">
          <v-chip :class="getStatusClass(item.status)" small>
            {{ getStatusLabel(item.status) }}
          </v-chip>
        </template>
        <template #item.sources_successful="{ item }">
          <span>{{ item.sources_successful.join(', ') }}</span>
        </template>
      </v-table>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: [String, Number, Object],
      default: null,
    },
    primaryKey: {
      type: [String, Number],
      required: true,
    },
    collection: {
      type: String,
      required: true,
    },
    options: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    return {
      loading: false,
      loadingHistory: false,
      lastResult: null,
      enrichmentHistory: [],
      showBadge: false,
      shouldPulse: false,
      historyHeaders: [
        { text: 'Date', value: 'timestamp', width: 180 },
        { text: 'Quality', value: 'quality_score', width: 100 },
        { text: 'Status', value: 'status', width: 120 },
        { text: 'Sources', value: 'sources_successful', width: 200 },
      ],
    };
  },
  computed: {
    canEnrich() {
      return this.primaryKey && this.collection === 'catalog_components';
    },
    buttonLabel() {
      return this.options.label || 'Enrich from Suppliers';
    },
  },
  mounted() {
    if (this.options.show_history) {
      this.loadEnrichmentHistory();
    }
  },
  methods: {
    async enrichComponent() {
      this.loading = true;
      this.showBadge = false;

      try {
        // Trigger the enrich-component operation via Directus Flow
        const response = await this.$api.post('/flows/trigger/manual-enrichment', {
          component_id: this.primaryKey,
        });

        this.lastResult = response.data;
        this.showBadge = true;

        // Show notification
        const notificationType = this.getNotificationType(this.lastResult.status);
        this.$notify({
          title: 'Enrichment Complete',
          text: this.lastResult.message,
          type: notificationType,
        });

        // Reload history
        if (this.options.show_history) {
          await this.loadEnrichmentHistory();
        }

        // Auto-refresh page if enabled
        if (this.options.auto_refresh && this.lastResult.status === 'completed') {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (error) {
        console.error('Enrichment failed:', error);
        this.$notify({
          title: 'Enrichment Failed',
          text: error.response?.data?.errors?.[0]?.message || error.message,
          type: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    async loadEnrichmentHistory() {
      this.loadingHistory = true;

      try {
        const response = await this.$api.get('/items/enrichment_history', {
          params: {
            filter: {
              component_id: { _eq: this.primaryKey },
            },
            sort: '-timestamp',
            limit: 10,
          },
        });

        this.enrichmentHistory = response.data.data || [];
      } catch (error) {
        console.error('Failed to load enrichment history:', error);
      } finally {
        this.loadingHistory = false;
      }
    },

    getScoreColor(score) {
      if (score >= 95) return 'success';
      if (score >= 70) return 'warning';
      return 'danger';
    },

    getStatusClass(status) {
      const classMap = {
        completed: 'status-completed',
        needs_review: 'status-review',
        rejected: 'status-rejected',
        error: 'status-error',
      };
      return classMap[status] || '';
    },

    getStatusLabel(status) {
      const labelMap = {
        completed: 'Production',
        needs_review: 'Staging',
        rejected: 'Rejected',
        error: 'Error',
      };
      return labelMap[status] || status;
    },

    getNotificationType(status) {
      if (status === 'completed') return 'success';
      if (status === 'needs_review') return 'warning';
      return 'error';
    },

    formatDate(timestamp) {
      if (!timestamp) return '-';
      return new Date(timestamp).toLocaleString();
    },
  },
};
</script>

<style scoped>
.enrich-button-interface {
  padding: 16px;
  background: var(--background-subdued);
  border-radius: 8px;
}

.button-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.pulse-animation {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.result-display {
  margin-top: 16px;
  padding: 16px;
  background: var(--background-normal);
  border-radius: 6px;
}

.quality-indicator {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.quality-label {
  font-weight: 600;
  color: var(--foreground-subdued);
}

.enrichment-details {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.source-chip {
  display: flex;
  align-items: center;
  gap: 4px;
}

.enriched-fields,
.missing-fields {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: var(--background-subdued);
  border-radius: 4px;
}

.label {
  font-size: 12px;
  color: var(--foreground-subdued);
}

.count {
  font-weight: 600;
  color: var(--foreground-normal);
}

.issues-list {
  margin-top: 12px;
}

.issues-list ul {
  margin: 0;
  padding-left: 20px;
}

.issues-list li {
  font-size: 13px;
  color: var(--warning);
}

.status-completed {
  background: var(--success);
  color: white;
}

.status-review {
  background: var(--warning);
  color: var(--warning-dark);
}

.status-rejected {
  background: var(--danger);
  color: white;
}

.status-error {
  background: var(--danger);
  color: white;
}

.history-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-normal);
}

.history-section h3 {
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground-normal);
}
</style>
